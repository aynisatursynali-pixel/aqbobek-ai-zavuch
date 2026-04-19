import re
from typing import Any

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from config import TELEGRAM_BOT_TOKEN
from data_loader import load_json, save_json
from gemini_ai import analyze_school_message
from school_ops import (
    EXPECTED_CLASSES as SHARED_EXPECTED_CLASSES,
    INCIDENT_ASSIGNMENT,
    append_incident,
    append_unique_task,
    build_attendance_summary,
    build_people_catalog,
    extract_teacher_names_from_slot,
    get_notifications,
    load_regulations,
    load_teachers,
    match_assignee,
    normalize_incident_type,
    normalize_task,
    now_str,
    propose_substitution,
    upsert_attendance,
    update_substitution_status_by_index,
    update_task_status_by_index,
)


TOKEN = TELEGRAM_BOT_TOKEN
EXPECTED_CLASSES = SHARED_EXPECTED_CLASSES
DAY_NAMES = ["Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"]


def build_people_names() -> list[str]:
    return [
        item.get("display_name") or item.get("name") or item.get("role")
        for item in build_people_catalog()
        if item.get("display_name") or item.get("name") or item.get("role")
    ]


def build_teacher_lookup() -> list[dict[str, str]]:
    lookup = []
    for teacher in load_teachers():
        full_name = str(teacher.get("teacher_name", "")).strip()
        if not full_name:
            continue
        parts = full_name.split()
        tokens = {full_name.lower()}
        if parts:
            tokens.add(parts[0].lower())
        if len(parts) >= 2:
            tokens.add(parts[1].lower())
        lookup.append(
            {
                "name": full_name,
                "tokens": "||".join(sorted(tokens, key=len, reverse=True)),
            }
        )
    return lookup


def find_teacher_in_text(text: str) -> str | None:
    lowered = text.lower()
    best_match = None
    best_length = 0
    for candidate in build_teacher_lookup():
        for token in candidate["tokens"].split("||"):
            if not token:
                continue
            if re.search(rf"\b{re.escape(token)}\b", lowered):
                if len(token) > best_length:
                    best_length = len(token)
                    best_match = candidate["name"]
    return best_match


def extract_absent_teacher_hint(text: str) -> str | None:
    match = re.match(
        r"^\s*([А-ЯA-ZӘІҢҒҮҰҚӨҺ][^,\.]{1,80}?)\s+(?:заболел|заболела|отсутствует|не будет|сегодня не выйдет)",
        text,
        flags=re.IGNORECASE,
    )
    if match:
        return match.group(1).strip()
    return None


def build_subject_catalog() -> list[str]:
    subjects = set()
    for teacher in load_teachers():
        for subject in teacher.get("subjects", []):
            if subject:
                subjects.add(str(subject).strip())
    for slot in load_json("master_schedule.json", []):
        subject_teacher = str(slot.get("subject_teacher", "")).strip()
        if subject_teacher:
            subjects.add(subject_teacher.split(" ")[0].strip())
    return sorted(subjects, key=len, reverse=True)


def find_subject_in_text(text: str) -> str | None:
    lowered = text.lower()
    for subject in build_subject_catalog():
        token = subject.lower()
        if token and token in lowered:
            return subject
    return None


def parse_day(text: str) -> str | None:
    for day in DAY_NAMES:
        if re.search(rf"\b{re.escape(day)}\b", text, flags=re.IGNORECASE):
            return day
    return None


def parse_lesson(text: str) -> int | None:
    match = re.search(r"(\d+)\s*(?:-?\s*й)?\s*урок", text.lower())
    return int(match.group(1)) if match else None


def parse_class(text: str) -> str | None:
    pattern = "|".join(re.escape(item) for item in EXPECTED_CLASSES)
    match = re.search(rf"\b({pattern})\b", text, flags=re.IGNORECASE)
    return match.group(1).upper() if match else None


def infer_slot(day: str | None, lesson: int | None, class_name: str | None) -> dict[str, Any] | None:
    if not all([day, lesson, class_name]):
        return None
    for slot in load_json("master_schedule.json", []):
        if (
            str(slot.get("day")) == str(day)
            and int(slot.get("lesson", 0) or 0) == int(lesson)
            and str(slot.get("class", "")).upper() == str(class_name).upper()
        ):
            return slot
    return None


def infer_teacher_from_slot(slot: dict[str, Any] | None) -> str | None:
    if not slot:
        return None
    names = extract_teacher_names_from_slot(slot.get("subject_teacher", ""))
    return names[0] if names else None


def infer_subject_from_slot(slot: dict[str, Any] | None) -> str | None:
    if not slot:
        return None
    raw = str(slot.get("subject_teacher", "")).strip()
    if not raw:
        return None
    names = extract_teacher_names_from_slot(raw)
    subject = raw
    for name in names:
        subject = subject.replace(name, "").strip(" /()-")
    return subject or raw.split(" ")[0]


def parse_attendance_message(text: str) -> dict[str, Any] | None:
    class_name = parse_class(text)
    if not class_name:
        return None

    numbers = [int(value) for value in re.findall(r"\d+", text)]
    filtered_numbers = [value for value in numbers if not class_name.startswith(str(value))]
    lowered = text.lower()

    present = None
    absent = None

    if any(word in lowered for word in ["отсутств", "болеют", "болен", "нет"]):
        if len(filtered_numbers) >= 2:
            present, absent = filtered_numbers[0], filtered_numbers[1]
        elif len(filtered_numbers) == 1:
            absent = filtered_numbers[0]
    elif any(word in lowered for word in ["присутств", "есть", "пришли", "на месте"]):
        if filtered_numbers:
            present = filtered_numbers[0]
    else:
        if len(filtered_numbers) >= 2:
            present, absent = filtered_numbers[0], filtered_numbers[1]
        elif len(filtered_numbers) == 1:
            present = filtered_numbers[0]

    if present is None and absent is None:
        return None

    return {
        "class": class_name,
        "present": int(present or 0),
        "absent": int(absent or 0),
        "message_text": text,
        "updated_at": now_str(),
    }


def build_incident_payload(text: str, analysis: dict[str, Any] | None = None) -> dict[str, Any] | None:
    incident = (analysis or {}).get("incident") or {}
    description = str(incident.get("description") or text).strip()
    if not description:
        return None

    incident_type = normalize_incident_type(incident.get("type") or "other")
    if incident_type == "other":
        lowered = text.lower()
        if any(word in lowered for word in ["плохо", "упал", "кровь", "болит", "без сознания", "дыш"]):
            incident_type = "medical"
        elif any(word in lowered for word in ["драка", "конфликт", "ударил", "агрессия"]):
            incident_type = "behavior"
        elif any(word in lowered for word in ["дым", "пожар", "газ", "искрит", "замыкание"]):
            incident_type = "safety"
        elif any(word in lowered for word in ["слом", "кран", "окно", "парта", "проектор", "не работает"]):
            incident_type = "maintenance"

    location = incident.get("location")
    if not location:
        room_match = re.search(r"(кабинет|каб\.?)\s*([0-9]+)", text, flags=re.IGNORECASE)
        if room_match:
            location = f"Кабинет {room_match.group(2)}"
        elif "туалет" in text.lower():
            location = "Туалет"

    priority = str(incident.get("priority") or "").lower()
    if priority not in {"normal", "high", "critical"}:
        priority = "critical" if incident_type == "medical" else "high" if incident_type in {"safety", "behavior"} else "normal"

    assigned_to = incident.get("assigned_to") or INCIDENT_ASSIGNMENT.get(incident_type, "Администрация")
    assigned_to = match_assignee(assigned_to)

    return {
        "text": description,
        "status": "new",
        "type": incident_type,
        "action": "awaiting_fix",
        "assigned_to": assigned_to,
        "priority": priority,
        "created_at": now_str(),
        "location": location,
    }


def create_incident_and_task(payload: dict[str, Any], *, medical_action: str | None = None) -> dict[str, Any]:
    incident_record = dict(payload)
    if medical_action:
        incident_record["action"] = medical_action
        incident_record["priority"] = "critical"
    append_incident(incident_record)

    title_suffix = f" ({incident_record['location']})" if incident_record.get("location") else ""
    append_unique_task(
        {
            "title": f"Инцидент: {incident_record['text']}{title_suffix}",
            "assignee": incident_record["assigned_to"],
            "deadline": "Срочно" if incident_record["priority"] == "critical" else "Сегодня",
            "status": "new",
            "source": "incident_auto",
            "priority": incident_record["priority"],
        }
    )
    return incident_record


def parse_substitution_request(text: str, analysis: dict[str, Any] | None = None) -> dict[str, Any] | None:
    request_data = (analysis or {}).get("substitution_request") or {}
    explicit_teacher = extract_absent_teacher_hint(text)
    absent_teacher = request_data.get("absent_teacher") or find_teacher_in_text(text) or explicit_teacher
    lesson = request_data.get("lesson") or parse_lesson(text)
    class_name = request_data.get("class_name") or request_data.get("class") or parse_class(text)
    day = request_data.get("day") or parse_day(text) or "Дүйсенбі"
    subject = request_data.get("subject") or find_subject_in_text(text)

    slot = infer_slot(day, lesson, class_name)
    if not absent_teacher and not explicit_teacher:
        absent_teacher = infer_teacher_from_slot(slot)
    if not subject:
        subject = infer_subject_from_slot(slot)

    if not any(word in text.lower() for word in ["заболел", "не будет", "замена", "заменить", "отсутствует", "сегодня не выйдет"]):
        return None

    return {
        "absent_teacher": absent_teacher,
        "lesson": lesson,
        "class_name": class_name,
        "day": day,
        "subject": subject,
    }


def format_attendance_summary() -> str:
    summary = build_attendance_summary()
    attendance_data = load_json("attendance_reports.json", [])
    lines = [
        "📊 Attendance summary",
        f"✅ Присутствуют: {summary['present']}",
        f"❌ Отсутствуют: {summary['absent']}",
        f"🍽 Порции: {summary['meals']}",
    ]
    if summary["missing_classes"]:
        lines.append(f"⏰ Не отчитались: {', '.join(summary['missing_classes'])}")
    else:
        lines.append("⏰ Все классы отчитались")

    if attendance_data:
        lines.append("")
        for item in sorted(attendance_data, key=lambda row: row.get("class", "")):
            lines.append(f"{item.get('class')}: ✅ {item.get('present', 0)} | ❌ {item.get('absent', 0)}")
    return "\n".join(lines)


def get_missing_classes() -> list[str]:
    return build_attendance_summary().get("missing_classes", [])


def format_substitution_card(item: dict[str, Any]) -> str:
    reasons = "; ".join(item.get("reason", [])[:3]) or "нет"
    candidate = item.get("substitute_teacher") or item.get("fallback_mode") or "не найден"
    return (
        f"🔄 {item.get('class', '-')} · {item.get('lesson', '-')} урок · {item.get('day', '-')}\n"
        f"📚 {item.get('subject', '-')}\n"
        f"👤 Нет: {item.get('absent_teacher', '-')}\n"
        f"✅ Замена: {candidate}\n"
        f"🏫 Кабинет: {item.get('room', '-')}\n"
        f"📌 Статус: {item.get('status', '-')}\n"
        f"🧠 {reasons}"
    )


def analyze_message(text: str) -> dict[str, Any]:
    return analyze_school_message(
        text,
        expected_classes=EXPECTED_CLASSES,
        staff_names=build_people_names(),
        document_codes=[str(item.get("code")) for item in load_regulations()],
    )


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "AI-завуч готов.\n\n"
        "Команды:\n"
        "/attendance\n"
        "/remind\n"
        "/incidents\n"
        "/substitutions\n"
        "/tasks\n"
        "/notifications"
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Я умею:\n"
        "• собирать attendance из свободного текста\n"
        "• напоминать по missing reports\n"
        "• вести инциденты и спрашивать про врача\n"
        "• подбирать замены по реальному расписанию\n"
        "• создавать задачи из директорских сообщений"
    )


async def attendance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(format_attendance_summary())


async def remind(update: Update, context: ContextTypes.DEFAULT_TYPE):
    missing = get_missing_classes()
    if not missing:
        await update.message.reply_text("✅ Все классы уже отправили attendance.")
        return
    await update.message.reply_text("⏰ Missing reports:\n" + "\n".join(f"• {item}" for item in missing))


async def incidents(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["incident_mode"] = True
    await update.message.reply_text(
        "⚠️ Режим инцидентов включен.\n"
        "Пришлите одну фразу: что случилось и где."
    )


async def substitutions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = load_json("substitutions.json", [])
    if not items:
        await update.message.reply_text("🔄 На сегодня замен нет.")
        return

    await update.message.reply_text(f"🔄 Всего замен: {len(items)}")
    for index, item in enumerate(items):
        keyboard = InlineKeyboardMarkup(
            [[
                InlineKeyboardButton("✅ Approve", callback_data=f"sub_approve_{index}"),
                InlineKeyboardButton("❌ Reject", callback_data=f"sub_reject_{index}"),
            ]]
        )
        await update.message.reply_text(format_substitution_card(item), reply_markup=keyboard)


async def tasks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = load_json("tasks.json", [])
    if not items:
        await update.message.reply_text("Задач пока нет.")
        return

    await update.message.reply_text(f"📝 Всего задач: {len(items)}")
    for index, item in enumerate(items):
        keyboard = InlineKeyboardMarkup(
            [[
                InlineKeyboardButton("🟡 In progress", callback_data=f"task_progress_{index}"),
                InlineKeyboardButton("✅ Done", callback_data=f"task_done_{index}"),
            ]]
        )
        await update.message.reply_text(
            f"📝 {item.get('title', '-')}\n"
            f"👤 {item.get('assignee', '-')}\n"
            f"⏳ {item.get('deadline', '-')}\n"
            f"📌 {item.get('status', '-')}",
            reply_markup=keyboard,
        )


async def notifications(update: Update, context: ContextTypes.DEFAULT_TYPE):
    items = get_notifications(limit=10)
    if not items:
        await update.message.reply_text("Уведомлений пока нет.")
        return
    lines = ["🔔 Последние уведомления"]
    for item in items:
        lines.append(f"• {item.get('title', '-')}: {item.get('message', '-')}")
    await update.message.reply_text("\n".join(lines))


async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data.startswith("medical_"):
        pending = context.user_data.get("pending_medical_incident")
        if not pending:
            await query.edit_message_text("Инцидент уже обработан.")
            return

        action = "doctor_called" if data == "medical_yes" else "doctor_not_called"
        incident = create_incident_and_task(pending, medical_action=action)
        context.user_data.pop("pending_medical_incident", None)
        await query.edit_message_text(
            f"🚑 Медицинский инцидент зарегистрирован.\n"
            f"Ответственный: {incident.get('assigned_to', '-')}\n"
            f"Действие: {action}"
        )
        return

    if data.startswith("sub_"):
        _, action, raw_index = data.split("_", 2)
        updated = update_substitution_status_by_index(int(raw_index), "approved" if action == "approve" else "rejected")
        if not updated:
            await query.edit_message_text("Запись не найдена.")
            return
        await query.edit_message_text(f"Статус замены: {updated['status']}")
        return

    if data.startswith("task_"):
        _, action, raw_index = data.split("_", 2)
        updated = update_task_status_by_index(int(raw_index), "in_progress" if action == "progress" else "done")
        if not updated:
            await query.edit_message_text("Задача не найдена.")
            return
        await query.edit_message_text(f"Статус задачи: {updated['status']}")


async def handle_incident_mode(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> bool:
    if not context.user_data.get("incident_mode"):
        return False

    context.user_data["incident_mode"] = False
    analysis = analyze_message(text)
    payload = build_incident_payload(text, analysis)
    if not payload:
        await update.message.reply_text("⚠️ Не смог понять инцидент. Попробуйте короче: что случилось и где.")
        return True

    if payload["type"] == "medical":
        context.user_data["pending_medical_incident"] = payload
        keyboard = InlineKeyboardMarkup(
            [[
                InlineKeyboardButton("🚑 Да", callback_data="medical_yes"),
                InlineKeyboardButton("❌ Нет", callback_data="medical_no"),
            ]]
        )
        await update.message.reply_text(
            f"⚠️ Медицинский инцидент: {payload['text']}\n"
            f"📍 {payload.get('location') or 'Локация не указана'}\n"
            "Вызвать врача?",
            reply_markup=keyboard,
        )
        return True

    incident = create_incident_and_task(payload)
    await update.message.reply_text(
        f"⚠️ Инцидент зарегистрирован.\n"
        f"Тип: {incident.get('type', '-')}\n"
        f"Ответственный: {incident.get('assigned_to', '-')}"
    )
    return True


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return

    text = update.message.text.strip()
    if not text:
        return

    if await handle_incident_mode(update, context, text):
        return

    analysis = analyze_message(text)

    attendance_payload = analysis.get("attendance")
    attendance_record = None
    if attendance_payload and attendance_payload.get("class_name") and attendance_payload.get("present") is not None:
        attendance_record = {
            "class": str(attendance_payload.get("class_name")).upper(),
            "present": int(attendance_payload.get("present") or 0),
            "absent": int(attendance_payload.get("absent") or 0),
            "message_text": attendance_payload.get("notes") or text,
            "updated_at": now_str(),
        }
    else:
        attendance_record = parse_attendance_message(text)

    if attendance_record:
        upsert_attendance(attendance_record)
        summary = build_attendance_summary()
        await update.message.reply_text(
            f"📊 Attendance принят: {attendance_record['class']}\n"
            f"✅ Присутствуют: {attendance_record['present']}\n"
            f"❌ Отсутствуют: {attendance_record['absent']}\n"
            f"🍽 Итого порций: {summary['meals']}"
        )
        return

    substitution_request = parse_substitution_request(text, analysis)
    if substitution_request:
        missing_fields = [
            label
            for label, value in [
                ("учитель", substitution_request.get("absent_teacher")),
                ("предмет", substitution_request.get("subject")),
                ("класс", substitution_request.get("class_name")),
                ("урок", substitution_request.get("lesson")),
                ("день", substitution_request.get("day")),
            ]
            if not value
        ]
        if missing_fields:
            await update.message.reply_text(
                "❌ Для замены не хватает: " + ", ".join(missing_fields) + ".\n"
                "Пример: Аскар заболел, 2 урок, математика, 7A, Дүйсенбі"
            )
            return

        record = propose_substitution(substitution_request)
        if not record:
            await update.message.reply_text("❌ Не удалось рассчитать замену.")
            return

        await update.message.reply_text(format_substitution_card(record))
        return

    incident_payload = build_incident_payload(text, analysis)
    if incident_payload and analysis.get("intent") in {"incident", "mixed"}:
        if incident_payload["type"] == "medical":
            context.user_data["pending_medical_incident"] = incident_payload
            keyboard = InlineKeyboardMarkup(
                [[
                    InlineKeyboardButton("🚑 Да", callback_data="medical_yes"),
                    InlineKeyboardButton("❌ Нет", callback_data="medical_no"),
                ]]
            )
            await update.message.reply_text(
                f"⚠️ Медицинский инцидент: {incident_payload['text']}\n"
                f"📍 {incident_payload.get('location') or 'Локация не указана'}\n"
                "Вызвать врача?",
                reply_markup=keyboard,
            )
            return

        incident = create_incident_and_task(incident_payload)
        await update.message.reply_text(
            f"⚠️ Инцидент зарегистрирован.\n"
            f"Тип: {incident.get('type', '-')}\n"
            f"Ответственный: {incident.get('assigned_to', '-')}"
        )
        return

    raw_tasks = analysis.get("tasks") or []
    if raw_tasks:
        created = 0
        for raw_task in raw_tasks:
            task = normalize_task(raw_task, source="director_text")
            if task["title"] and append_unique_task(task):
                created += 1
        await update.message.reply_text(f"✅ Создано задач: {created}")
        return

    if analysis.get("document_request"):
        await update.message.reply_text("📄 Запрос на документ распознан. Откройте Document Lab в dashboard.")
        return

    if any(word in text.lower() for word in ["кабинет", "слом", "не работает", "плохо", "упал", "кровь", "кран", "драка"]):
        context.user_data["incident_mode"] = True
        await update.message.reply_text("⚠️ Похоже на инцидент. Пришлите одной фразой: что случилось и где.")
        return

    await update.message.reply_text("🤔 Не понял сообщение. Попробуйте attendance, инцидент, замену или поручение директору.")


def main():
    if not TOKEN or TOKEN == "PASTE_YOUR_TELEGRAM_BOT_TOKEN":
        raise RuntimeError("TELEGRAM_BOT_TOKEN не настроен в .env")

    app = ApplicationBuilder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("attendance", attendance))
    app.add_handler(CommandHandler("remind", remind))
    app.add_handler(CommandHandler("incidents", incidents))
    app.add_handler(CommandHandler("substitutions", substitutions))
    app.add_handler(CommandHandler("tasks", tasks))
    app.add_handler(CommandHandler("notifications", notifications))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    print("Bot is running...")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
