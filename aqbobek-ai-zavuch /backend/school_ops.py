from collections import defaultdict
from datetime import datetime
import re

from data_loader import load_json, save_json
from storage import append_audit_log, append_notification, load_audit_log, load_notifications


EXPECTED_CLASSES = ["7A", "7B", "7C", "8A", "8B", "8C", "8D", "9A", "9B", "10A", "10B", "11A", "11B"]

INCIDENT_ASSIGNMENT = {
    "medical": "Медработник",
    "maintenance": "Завхоз",
    "behavior": "Администрация",
    "safety": "Администрация",
    "other": "Администрация",
}

INCIDENT_TYPE_ALIASES = {
    "broken equipment": "maintenance",
    "equipment": "maintenance",
    "maintenance": "maintenance",
    "medical": "medical",
    "health": "medical",
    "behavior": "behavior",
    "safety": "safety",
    "other": "other",
}


def now_str():
    return datetime.now().strftime("%Y-%m-%d %H:%M")


def normalize_text(text):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\sа-яәіңғүұқөһ]", " ", str(text).lower())).strip()


def normalize_incident_type(value):
    normalized = normalize_text(value)
    return INCIDENT_TYPE_ALIASES.get(normalized, "other")


def log_event(event_type: str, entity_type: str, summary: str, payload=None):
    append_audit_log(event_type, entity_type, summary, payload or {}, created_at=now_str())


def notify(title: str, message: str, *, audience="director", tone="neutral", payload=None):
    notification = {
        "created_at": now_str(),
        "title": title,
        "message": message,
        "audience": audience,
        "tone": tone,
        "payload": payload or {},
    }
    append_notification(notification)
    return notification


def load_teachers():
    return load_json("teachers.json", [])


def load_staff_directory():
    return load_json("staff_directory.json", [])


def load_regulations():
    return load_json("regulations.json", [])


def load_regulation_chunks():
    return load_json("regulation_chunks.json", [])


def build_people_catalog():
    people = []
    for teacher in load_teachers():
        full_name = str(teacher.get("teacher_name", "")).strip()
        if not full_name:
            continue
        people.append(
            {
                "name": full_name,
                "display_name": full_name,
                "role": "Педагог",
                "type": "teacher",
                "skills": teacher.get("subjects", []),
            }
        )

    for member in load_staff_directory():
        people.append(
            {
                "name": member.get("name", ""),
                "display_name": member.get("name", ""),
                "role": member.get("role", ""),
                "type": member.get("type", "staff"),
                "skills": member.get("skills", []),
                "telegram_chat_id": member.get("telegram_chat_id"),
            }
        )

    return people


def build_attendance_summary():
    data = load_json("attendance_reports.json", [])
    total_present = sum(int(item.get("present", 0) or 0) for item in data)
    total_absent = sum(int(item.get("absent", 0) or 0) for item in data)
    reported = [item.get("class") for item in data]
    missing = [class_name for class_name in EXPECTED_CLASSES if class_name not in reported]

    return {
        "present": total_present,
        "absent": total_absent,
        "meals": total_present,
        "missing_classes": missing,
        "coverage_ratio": round(len(reported) / len(EXPECTED_CLASSES), 2) if EXPECTED_CLASSES else 0,
    }


def upsert_attendance(report):
    attendance = load_json("attendance_reports.json", [])
    updated = False
    for item in attendance:
        if item.get("class") == report.get("class"):
            item.update(report)
            updated = True
            break
    if not updated:
        attendance.append(report)
    save_json("attendance_reports.json", attendance)

    log_event("upsert", "attendance", f"Обновлен attendance для {report.get('class')}", report)
    notify(
        "Attendance updated",
        f"{report.get('class')}: присутствуют {report.get('present')}, отсутствуют {report.get('absent')}.",
        tone="good",
        payload={"class": report.get("class")},
    )
    return report


def append_unique_task(task):
    tasks = load_json("tasks.json", [])
    exists = any(
        item.get("title") == task.get("title")
        and item.get("assignee") == task.get("assignee")
        and item.get("deadline") == task.get("deadline")
        for item in tasks
    )
    if not exists:
        tasks.append(task)
        save_json("tasks.json", tasks)
        log_event("create", "task", f"Создана задача для {task.get('assignee')}", task)
        notify(
            "New task",
            f"{task.get('assignee')}: {task.get('title')}",
            audience=task.get("assignee", "director"),
            tone="warn" if task.get("priority") in {"high", "critical"} else "neutral",
            payload=task,
        )
        return True
    return False


def append_incident(incident):
    incidents = load_json("incidents.json", [])
    incidents.append(incident)
    save_json("incidents.json", incidents)
    log_event("create", "incident", f"Зарегистрирован инцидент: {incident.get('text')}", incident)
    notify(
        "Incident registered",
        f"{incident.get('assigned_to')}: {incident.get('text')}",
        audience=incident.get("assigned_to", "director"),
        tone="bad" if incident.get("priority") == "critical" else "warn",
        payload=incident,
    )
    return incident


def match_assignee(raw_name):
    candidate = normalize_text(raw_name)
    if not candidate:
        return "Администрация"

    for person in build_people_catalog():
        person_name = normalize_text(person.get("name"))
        person_role = normalize_text(person.get("role"))
        if candidate == person_name or candidate in person_name or person_name in candidate:
            return person.get("display_name") or person.get("name")
        if person_role and (candidate == person_role or candidate in person_role or person_role in candidate):
            return person.get("display_name") or person.get("name")

    return raw_name.strip()


def normalize_task(task, *, source="dashboard_ai"):
    assignee = match_assignee(task.get("assignee", "Администрация"))
    priority = str(task.get("priority") or "normal").lower()
    if priority not in {"low", "normal", "high", "critical"}:
        priority = "normal"

    return {
        "title": str(task.get("title", "")).strip(),
        "assignee": assignee or "Администрация",
        "deadline": str(task.get("deadline") or "Не указан").strip(),
        "status": "new",
        "source": source,
        "priority": priority,
    }


def get_teacher_signatures():
    signatures = []
    for teacher in load_teachers():
        name = str(teacher.get("teacher_name", "")).strip()
        if not name:
            continue
        surname = name.split()[0]
        signatures.append((normalize_text(surname), name))
        signatures.append((normalize_text(name), name))
    return signatures


def extract_teacher_names_from_slot(subject_teacher):
    subject_teacher_norm = normalize_text(subject_teacher)
    matches = []
    for signature, full_name in get_teacher_signatures():
        if signature and signature in subject_teacher_norm and full_name not in matches:
            matches.append(full_name)
    return matches


def build_teacher_day_loads(day):
    schedule = load_json("master_schedule.json", [])
    loads = defaultdict(int)
    for slot in schedule:
        if str(slot.get("day")) != str(day):
            continue
        for teacher_name in extract_teacher_names_from_slot(slot.get("subject_teacher", "")):
            loads[teacher_name] += 1
    return loads


def build_schedule_insights(day=None):
    schedule = load_json("master_schedule.json", [])
    teacher_days = defaultdict(lambda: defaultdict(list))
    teacher_rooms = defaultdict(set)

    for slot in schedule:
        if day and str(slot.get("day")) != day:
            continue
        for teacher_name in extract_teacher_names_from_slot(slot.get("subject_teacher", "")):
            teacher_days[teacher_name][slot.get("day")].append(int(slot.get("lesson", 0) or 0))
            room = str(slot.get("room", "")).strip()
            if room:
                teacher_rooms[teacher_name].add(room)

    insights = []
    for teacher_name, by_day in teacher_days.items():
        daily_counts = {current_day: len(sorted(lessons)) for current_day, lessons in by_day.items()}
        max_daily = max(daily_counts.values(), default=0)
        total = sum(daily_counts.values())
        longest_streak = 0
        for lessons in by_day.values():
            current_streak = 0
            previous = None
            for lesson in sorted(set(lessons)):
                if previous is not None and lesson == previous + 1:
                    current_streak += 1
                else:
                    current_streak = 1
                previous = lesson
                longest_streak = max(longest_streak, current_streak)

        if max_daily >= 6 or longest_streak >= 5:
            status = "hot"
        elif max_daily >= 4:
            status = "busy"
        else:
            status = "normal"

        insights.append(
            {
                "teacher_name": teacher_name,
                "total_lessons": total,
                "max_daily_lessons": max_daily,
                "longest_streak": longest_streak,
                "rooms": sorted(teacher_rooms.get(teacher_name, [])),
                "status": status,
            }
        )

    insights.sort(key=lambda item: (item["status"] != "hot", -item["max_daily_lessons"], -item["total_lessons"]))
    return insights


def build_schedule_conflicts(day=None):
    schedule = load_json("master_schedule.json", [])
    room_buckets = defaultdict(list)
    teacher_buckets = defaultdict(list)
    class_buckets = defaultdict(list)

    for slot in schedule:
        if day and str(slot.get("day")) != str(day):
            continue
        key_base = (slot.get("day"), int(slot.get("lesson", 0) or 0))
        room = str(slot.get("room", "")).strip()
        class_name = str(slot.get("class", "")).strip()

        if room:
            room_buckets[key_base + (room,)].append(slot)
        if class_name:
            class_buckets[key_base + (class_name,)].append(slot)
        for teacher_name in extract_teacher_names_from_slot(slot.get("subject_teacher", "")):
            teacher_buckets[key_base + (teacher_name,)].append(slot)

    conflicts = []

    for buckets, conflict_type, title in [
        (room_buckets, "room_conflict", "Конфликт кабинета"),
        (teacher_buckets, "teacher_conflict", "Конфликт учителя"),
        (class_buckets, "class_conflict", "Два занятия у одного класса"),
    ]:
        for key, items in buckets.items():
            if len(items) <= 1:
                continue
            conflicts.append(
                {
                    "type": conflict_type,
                    "title": title,
                    "day": key[0],
                    "lesson": key[1],
                    "resource": key[2],
                    "items": items,
                }
            )

    return conflicts


def build_staff_plans(day=None):
    current_day = day or "Дүйсенбі"
    open_tasks = load_json("tasks.json", [])
    open_incidents = load_json("incidents.json", [])
    people = []

    for member in load_staff_directory():
        plan = list(member.get("default_plan", {}).get(current_day, []))
        assignee_norm = normalize_text(member.get("name")) + " " + normalize_text(member.get("role"))

        for task in open_tasks:
            task_assignee = normalize_text(task.get("assignee", ""))
            if task_assignee and (task_assignee in assignee_norm or assignee_norm in task_assignee):
                plan.append(
                    {
                        "time": "Динамически",
                        "title": task.get("title"),
                        "type": "task",
                        "status": task.get("status", "new"),
                    }
                )

        for incident in open_incidents:
            assigned_to = normalize_text(incident.get("assigned_to", ""))
            if assigned_to and assigned_to in assignee_norm:
                plan.append(
                    {
                        "time": "Сразу после регистрации",
                        "title": incident.get("text"),
                        "type": "incident",
                        "status": incident.get("status", "new"),
                    }
                )

        people.append(
            {
                "id": member.get("id"),
                "name": member.get("name"),
                "role": member.get("role"),
                "department": member.get("department"),
                "telegram_chat_id": member.get("telegram_chat_id"),
                "plan": plan,
            }
        )

    return people


def build_personal_schedule(person_name, day=None):
    person_norm = normalize_text(person_name)
    schedule = load_json("master_schedule.json", [])
    personal = []

    for slot in schedule:
        if day and str(slot.get("day")) != str(day):
            continue
        for teacher_name in extract_teacher_names_from_slot(slot.get("subject_teacher", "")):
            if normalize_text(teacher_name) == person_norm:
                personal.append(
                    {
                        "time": slot.get("time"),
                        "day": slot.get("day"),
                        "lesson": slot.get("lesson"),
                        "class": slot.get("class"),
                        "subject_teacher": slot.get("subject_teacher"),
                        "room": slot.get("room"),
                    }
                )

    for member in build_staff_plans(day=day):
        if normalize_text(member.get("name")) == person_norm:
            personal.extend(
                {
                    "time": block.get("time"),
                    "day": day or "Все дни",
                    "lesson": None,
                    "class": None,
                    "subject_teacher": block.get("title"),
                    "room": member.get("department"),
                    "type": block.get("type"),
                }
                for block in member.get("plan", [])
            )

    return personal


def regulation_search(query, selected_code=None, limit=4):
    documents = load_regulations()
    chunks = load_regulation_chunks()
    query_norm = normalize_text(query)
    tokens = [token for token in query_norm.split() if token]
    scored = []

    for chunk in chunks:
        if selected_code and str(chunk.get("code")) != str(selected_code):
            continue
        haystack = normalize_text(
            " ".join(
                [
                    str(chunk.get("title", "")),
                    str(chunk.get("section", "")),
                    str(chunk.get("content", "")),
                    " ".join(chunk.get("keywords", [])),
                ]
            )
        )
        score = sum(1 for token in tokens if token in haystack)
        if selected_code and str(chunk.get("code")) == str(selected_code):
            score += 4
        if score:
            scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    selected_chunks = [item[1] for item in scored[:limit]]

    if not selected_chunks:
        selected_chunks = [chunk for chunk in chunks if not selected_code or str(chunk.get("code")) == str(selected_code)][:limit]

    enriched = []
    for chunk in selected_chunks:
        doc = next((item for item in documents if str(item.get("code")) == str(chunk.get("code"))), {})
        enriched.append(
            {
                "code": chunk.get("code"),
                "title": doc.get("title") or chunk.get("title"),
                "section": chunk.get("section"),
                "summary": doc.get("summary"),
                "digest": doc.get("digest", []),
                "sample_uses": doc.get("sample_uses", []),
                "source_url": chunk.get("source_url") or doc.get("source_url"),
                "excerpt": chunk.get("content"),
                "keywords": chunk.get("keywords", []),
            }
        )
    return enriched


def _subject_matches(candidate_subjects, target_subject):
    target_norm = normalize_text(target_subject)
    for subject in candidate_subjects:
        subject_norm = normalize_text(subject)
        if target_norm and (target_norm in subject_norm or subject_norm in target_norm):
            return True
    return False


def _same_teacher(name1, name2):
    left = normalize_text(name1).split()
    right = normalize_text(name2).split()
    return bool(left and right and left[0] == right[0])


def _teacher_busy(teacher_name, day, lesson_number, schedule):
    teacher_norm = normalize_text(teacher_name)
    for slot in schedule:
        if str(slot.get("day")) != str(day):
            continue
        if int(slot.get("lesson", 0) or 0) != int(lesson_number or 0):
            continue
        subject_teacher = normalize_text(slot.get("subject_teacher", ""))
        if teacher_norm and teacher_norm.split()[0] in subject_teacher:
            return True
    return False


def _admin_fallback(target_day, target_lesson):
    admin_candidates = []
    for member in load_staff_directory():
        skills = [normalize_text(skill) for skill in member.get("skills", [])]
        if any(token in " ".join(skills) for token in ["расписание", "контроль", "метод"]):
            admin_candidates.append(member)

    if admin_candidates:
        member = admin_candidates[0]
        return {
            "teacher_name": member.get("name"),
            "weekly_load": 0,
            "daily_load": 0,
            "score": 10,
            "fallback_mode": "admin_cover",
            "reason": [
                f"предметник не найден, предложен административный fallback на {target_day} {target_lesson} урок",
                f"роль: {member.get('role')}",
            ],
        }

    return {
        "teacher_name": None,
        "weekly_load": 0,
        "daily_load": 0,
        "score": 0,
        "fallback_mode": "supervised_self_study",
        "reason": [
            "предметник и админ-fallback не найдены",
            "рекомендуется самостоятельная работа под присмотром свободного дежурного",
        ],
    }


def propose_substitution(request):
    schedule = load_json("master_schedule.json", [])
    teachers = load_teachers()

    target_day = request.get("day")
    target_lesson = int(request.get("lesson") or 0)
    target_class = str(request.get("class") or request.get("class_name") or "").upper()
    target_subject = str(request.get("subject") or "").strip()
    absent_teacher = str(request.get("absent_teacher") or "").strip()

    if not all([target_day, target_lesson, target_class]):
        return None

    target_slot = None
    for slot in schedule:
        if (
            str(slot.get("day")) == str(target_day)
            and int(slot.get("lesson", 0) or 0) == target_lesson
            and str(slot.get("class", "")).upper() == target_class
        ):
            target_slot = slot
            break

    if not target_subject and target_slot:
        target_subject = str(target_slot.get("subject_teacher", "")).split(" ", 1)[0]

    daily_loads = build_teacher_day_loads(target_day)
    candidates = []
    for teacher in teachers:
        teacher_name = teacher.get("teacher_name", "")
        if teacher.get("status") != "active":
            continue
        if absent_teacher and _same_teacher(teacher_name, absent_teacher):
            continue
        if target_subject and not _subject_matches(teacher.get("subjects", []), target_subject):
            continue
        if _teacher_busy(teacher_name, target_day, target_lesson, schedule):
            continue

        weekly_load = int(teacher.get("weekly_load", 0) or 0)
        daily_load = int(daily_loads.get(teacher_name, 0) or 0)
        score = 100
        score -= weekly_load // 2
        score -= daily_load * 7
        if target_slot and target_slot.get("room"):
            teacher_rooms = {item.get("room") for item in build_personal_schedule(teacher_name, day=target_day)}
            if target_slot.get("room") in teacher_rooms:
                score += 2

        candidates.append(
            {
                "teacher_name": teacher_name,
                "weekly_load": weekly_load,
                "daily_load": daily_load,
                "score": score,
                "fallback_mode": None,
                "reason": [
                    f"совпадает профиль по предмету: {target_subject or 'уточнить'}",
                    f"свободен(а) на {target_lesson} уроке",
                    f"нагрузка в день: {daily_load}",
                    f"недельная нагрузка: {weekly_load}",
                ],
            }
        )

    candidates.sort(key=lambda item: item["score"], reverse=True)
    best = candidates[0] if candidates else _admin_fallback(target_day, target_lesson)

    status = "proposed" if best.get("teacher_name") else "unresolved"
    record = {
        "day": target_day,
        "time": target_slot.get("time") if target_slot else "-",
        "lesson": target_lesson,
        "class": target_class,
        "subject": target_subject or "Не определен",
        "room": target_slot.get("room") if target_slot else "-",
        "absent_teacher": absent_teacher or "Не указан",
        "substitute_teacher": best.get("teacher_name"),
        "all_candidates": [item["teacher_name"] for item in candidates[:3] if item.get("teacher_name")],
        "reason": best.get("reason") if best else ["подходящий свободный учитель не найден"],
        "status": status,
        "daily_load": best.get("daily_load", 0),
        "weekly_load": best.get("weekly_load", 0),
        "fallback_mode": best.get("fallback_mode"),
    }

    substitutions = load_json("substitutions.json", [])
    updated = False
    for index, existing in enumerate(substitutions):
        if (
            str(existing.get("day")) == str(record.get("day"))
            and int(existing.get("lesson", 0) or 0) == int(record.get("lesson", 0) or 0)
            and str(existing.get("class", "")).upper() == str(record.get("class", "")).upper()
        ):
            substitutions[index] = record
            updated = True
            break
    if not updated:
        substitutions.append(record)
    save_json("substitutions.json", substitutions)

    log_event("create_or_update", "substitution", f"Пересчитана замена для {target_class} на {target_day} {target_lesson} урок", record)
    notify(
        "Substitution recalculated",
        f"{target_class}, {target_lesson} урок: {record.get('substitute_teacher') or 'не найдено решение'}",
        tone="warn" if record["status"] == "proposed" else "bad",
        payload=record,
    )
    return record


def update_task_status_by_index(index: int, status: str):
    tasks = load_json("tasks.json", [])
    if index < 0 or index >= len(tasks):
        return None
    tasks[index]["status"] = status
    save_json("tasks.json", tasks)
    log_event("status_change", "task", f"Задача переведена в статус {status}", tasks[index])
    return tasks[index]


def update_incident_status_by_index(index: int, status: str):
    incidents = load_json("incidents.json", [])
    if index < 0 or index >= len(incidents):
        return None
    incidents[index]["status"] = status
    save_json("incidents.json", incidents)
    log_event("status_change", "incident", f"Инцидент переведен в статус {status}", incidents[index])
    return incidents[index]


def update_substitution_status_by_index(index: int, status: str):
    substitutions = load_json("substitutions.json", [])
    if index < 0 or index >= len(substitutions):
        return None
    substitutions[index]["status"] = status
    save_json("substitutions.json", substitutions)
    log_event("status_change", "substitution", f"Замена переведена в статус {status}", substitutions[index])
    return substitutions[index]


def apply_ai_analysis(analysis, *, source="dashboard_ai", persist=True):
    created = {"attendance": False, "incident": False, "tasks": 0, "substitution": False, "document_request": False}
    notes = []

    attendance = analysis.get("attendance")
    if attendance and attendance.get("class_name") and attendance.get("present") is not None and persist:
        report = {
            "class": str(attendance.get("class_name")).upper(),
            "present": int(attendance.get("present") or 0),
            "absent": int(attendance.get("absent") or 0),
            "message_text": attendance.get("notes") or analysis.get("summary") or "",
            "updated_at": now_str(),
        }
        upsert_attendance(report)
        created["attendance"] = True
        notes.append(f"Attendance обновлен для {report['class']}.")

    incident = analysis.get("incident")
    if incident and incident.get("description") and persist:
        incident_type = normalize_incident_type(incident.get("type") or "other")
        incident_record = {
            "text": incident.get("description"),
            "status": "new",
            "type": incident_type,
            "action": "awaiting_fix",
            "assigned_to": match_assignee(incident.get("assigned_to") or INCIDENT_ASSIGNMENT.get(incident_type, "Администрация")),
            "priority": str(incident.get("priority") or "high").lower(),
            "created_at": now_str(),
            "location": incident.get("location"),
        }
        append_incident(incident_record)
        append_unique_task(
            {
                "title": f"Устранить инцидент: {incident_record['text']}",
                "assignee": incident_record["assigned_to"],
                "deadline": "Сегодня",
                "status": "new",
                "source": "incident_auto",
                "priority": incident_record["priority"],
            }
        )
        created["incident"] = True
        notes.append(f"Инцидент зарегистрирован для {incident_record['assigned_to']}.")
    elif incident and incident.get("description") and not persist:
        created["incident"] = True
        notes.append("Обнаружен инцидент.")

    for raw_task in analysis.get("tasks", []):
        task = normalize_task(raw_task, source=source)
        if task["title"] and persist and append_unique_task(task):
            created["tasks"] += 1
        elif task["title"] and not persist:
            created["tasks"] += 1
    if created["tasks"]:
        notes.append(f"Создано задач: {created['tasks']}.")

    substitution_request = analysis.get("substitution_request")
    if substitution_request and substitution_request.get("lesson") and substitution_request.get("class_name") and persist:
        record = propose_substitution(substitution_request)
        if record:
            created["substitution"] = True
            substitute_teacher = record.get("substitute_teacher") or record.get("fallback_mode") or "не найден"
            notes.append(f"Замена рассчитана: {substitute_teacher}.")
    elif substitution_request and substitution_request.get("lesson") and substitution_request.get("class_name") and not persist:
        created["substitution"] = True
        notes.append("Обнаружен запрос на замену.")

    if analysis.get("document_request"):
        created["document_request"] = True
        notes.append("Обнаружен запрос на документ. Откройте Document Lab для черновика.")
        log_event("detect", "document_request", "AI распознал документный запрос", analysis.get("document_request"))

    handled = any(value for key, value in created.items() if key != "tasks") or created["tasks"] > 0
    return {
        "handled": handled,
        "created": created,
        "notes": notes,
        "summary": analysis.get("summary") or (" ".join(notes) if notes else "Сообщение распознано частично."),
        "analysis": analysis,
    }


def get_notifications(limit=50):
    return load_notifications(limit=limit)


def get_audit(limit=100):
    return load_audit_log(limit=limit)
