import json
import ssl
import urllib.error
import urllib.request
from typing import Any

from config import GEMINI_API_KEY, GEMINI_MODELS, GEMINI_VERIFY_SSL


API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
LAST_STATUS = {
    "configured": bool(GEMINI_API_KEY),
    "available": False,
    "active_model": None,
    "last_error": None,
}


def _build_ssl_context():
    if GEMINI_VERIFY_SSL:
        try:
            import certifi  # type: ignore

            return ssl.create_default_context(cafile=certifi.where())
        except Exception:
            return ssl.create_default_context()

    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def _extract_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates", [])
    if not candidates:
        return ""

    parts = candidates[0].get("content", {}).get("parts", [])
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "".join(texts).strip()


def get_gemini_status():
    return dict(LAST_STATUS)


def _request_json(model: str, body: dict[str, Any]) -> dict[str, Any]:
    url = f"{API_BASE}/{model}:generateContent"
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        method="POST",
    )
    request.add_header("x-goog-api-key", GEMINI_API_KEY)
    request.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(request, timeout=45, context=_build_ssl_context()) as response:
        return json.load(response)


def generate_json(prompt: str, schema: dict[str, Any], *, temperature: float = 0.15) -> dict[str, Any]:
    if not GEMINI_API_KEY:
        LAST_STATUS.update(
            {
                "configured": False,
                "available": False,
                "active_model": None,
                "last_error": "GEMINI_API_KEY is not configured",
            }
        )
        raise RuntimeError("Gemini API key is not configured")

    last_error = None
    for model in GEMINI_MODELS:
        body = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
                "responseJsonSchema": schema,
            },
        }

        try:
            payload = _request_json(model, body)
            text = _extract_text(payload)
            parsed = json.loads(text)
            LAST_STATUS.update(
                {
                    "configured": True,
                    "available": True,
                    "active_model": model,
                    "last_error": None,
                }
            )
            return {"model": model, "data": parsed}
        except urllib.error.HTTPError as error:
            details = error.read().decode("utf-8", errors="ignore")
            last_error = f"{model}: HTTP {error.code} {details[:240]}"
        except Exception as error:  # pragma: no cover - defensive path
            last_error = f"{model}: {error}"

    LAST_STATUS.update(
        {
            "configured": True,
            "available": False,
            "active_model": None,
            "last_error": last_error,
        }
    )
    raise RuntimeError(last_error or "Gemini request failed")


def _message_schema():
    return {
        "type": "object",
        "properties": {
            "intent": {"type": "string"},
            "summary": {"type": "string"},
            "attendance": {
                "type": ["object", "null"],
                "properties": {
                    "class_name": {"type": ["string", "null"]},
                    "present": {"type": ["integer", "null"]},
                    "absent": {"type": ["integer", "null"]},
                    "notes": {"type": ["string", "null"]},
                },
                "required": ["class_name", "present", "absent", "notes"],
            },
            "incident": {
                "type": ["object", "null"],
                "properties": {
                    "type": {"type": ["string", "null"]},
                    "location": {"type": ["string", "null"]},
                    "description": {"type": ["string", "null"]},
                    "priority": {"type": ["string", "null"]},
                    "assigned_to": {"type": ["string", "null"]},
                },
                "required": ["type", "location", "description", "priority", "assigned_to"],
            },
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "assignee": {"type": "string"},
                        "deadline": {"type": ["string", "null"]},
                        "priority": {"type": ["string", "null"]},
                    },
                    "required": ["title", "assignee", "deadline", "priority"],
                },
            },
            "substitution_request": {
                "type": ["object", "null"],
                "properties": {
                    "absent_teacher": {"type": ["string", "null"]},
                    "lesson": {"type": ["integer", "null"]},
                    "class_name": {"type": ["string", "null"]},
                    "day": {"type": ["string", "null"]},
                    "subject": {"type": ["string", "null"]},
                },
                "required": ["absent_teacher", "lesson", "class_name", "day", "subject"],
            },
            "document_request": {
                "type": ["object", "null"],
                "properties": {
                    "document_code": {"type": ["string", "null"]},
                    "goal": {"type": ["string", "null"]},
                    "details": {"type": ["string", "null"]},
                },
                "required": ["document_code", "goal", "details"],
            },
            "followup_questions": {
                "type": "array",
                "items": {"type": "string"},
            },
        },
        "required": [
            "intent",
            "summary",
            "attendance",
            "incident",
            "tasks",
            "substitution_request",
            "document_request",
            "followup_questions",
        ],
    }


def _document_schema():
    return {
        "type": "object",
        "properties": {
            "document_title": {"type": "string"},
            "plain_summary": {"type": "string"},
            "missing_information": {"type": "array", "items": {"type": "string"}},
            "action_checklist": {"type": "array", "items": {"type": "string"}},
            "draft_text": {"type": "string"},
            "teacher_friendly_explanation": {"type": "string"},
        },
        "required": [
            "document_title",
            "plain_summary",
            "missing_information",
            "action_checklist",
            "draft_text",
            "teacher_friendly_explanation",
        ],
    }


def analyze_school_message(
    text: str,
    *,
    expected_classes: list[str],
    staff_names: list[str],
    document_codes: list[str],
) -> dict[str, Any]:
    prompt = f"""
Ты работаешь как AI-завуч школы Aqbobek.
Разбери одно сообщение и верни строго JSON по схеме.

Правила:
- Не выдумывай факты, которых нет.
- Если поле неизвестно, верни null.
- Если в сообщении несколько поручений директору, верни их массивом tasks.
- attendance используется для сообщений вида "7A - 25 детей, 2 болеют".
- incident используется для поломок, медситуаций, конфликтов, угроз безопасности.
- substitution_request используется для болезней учителей и запроса замены.
- document_request используется для запросов типа "подготовь приказ", "нужен 76 приказ", "сделай отчет".
- intent выбери из: attendance, incident, task_batch, substitution, document_request, mixed, general.

Доступные классы: {", ".join(expected_classes)}.
Справочник сотрудников и ролей: {", ".join(staff_names[:60])}.
Коды документов для document_request: {", ".join(document_codes)}.

Сообщение:
\"\"\"{text}\"\"\"
""".strip()

    try:
        return generate_json(prompt, _message_schema())["data"]
    except Exception:
        return fallback_message_analysis(
            text,
            expected_classes=expected_classes,
            staff_names=staff_names,
            document_codes=document_codes,
        )


def generate_document_copilot(
    query: str,
    *,
    selected_document: str,
    snippets: list[dict[str, Any]],
) -> dict[str, Any]:
    snippet_block = "\n\n".join(
        f"[{item.get('code')}] {item.get('title')}\n"
        f"Раздел: {item.get('section')}\n"
        f"Источник: {item.get('source_url')}\n"
        f"Извлеченный фрагмент: {item.get('excerpt')}\n"
        f"Ключевые тезисы: {'; '.join(item.get('digest', []))}\n"
        f"Практика: {'; '.join(item.get('sample_uses', []))}"
        for item in snippets
    )

    prompt = f"""
Ты помогаешь директору школы подготовить понятный и юридически осторожный черновик.
Используй только контекст ниже. Если данных мало, явно сформулируй, чего не хватает.

Выбранный документ: {selected_document}
Запрос директора: {query}

Контекст:
{snippet_block}
""".strip()

    result = generate_json(prompt, _document_schema())["data"]
    result["sources"] = [
        {
            "code": item.get("code"),
            "title": item.get("title"),
            "section": item.get("section"),
            "excerpt": item.get("excerpt"),
            "source_url": item.get("source_url"),
        }
        for item in snippets
    ]
    return result


def fallback_message_analysis(
    text: str,
    *,
    expected_classes: list[str],
    staff_names: list[str],
    document_codes: list[str],
) -> dict[str, Any]:
    import re

    lowered = text.lower().strip()
    attendance = None
    incident = None
    tasks = []
    substitution_request = None
    document_request = None
    intent = "general"
    summary = "Сообщение требует ручной проверки."

    class_pattern = "|".join(re.escape(item) for item in expected_classes)
    class_match = re.search(rf"\b({class_pattern})\b", text, flags=re.IGNORECASE)
    numbers = [int(value) for value in re.findall(r"\d+", text)]

    if class_match and numbers:
        class_name = class_match.group(1).upper()
        filtered_numbers = [value for value in numbers if not class_name.startswith(str(value))]
        present = filtered_numbers[0] if filtered_numbers else None
        absent = filtered_numbers[1] if len(filtered_numbers) > 1 else 0
        attendance = {
            "class_name": class_name,
            "present": present,
            "absent": absent,
            "notes": text,
        }
        intent = "attendance"
        summary = f"Определен attendance-отчет по {class_name}."

    if any(word in lowered for word in ["слом", "кран", "окно", "плохо", "упал", "кровь", "дым", "драка"]):
        incident = {
            "type": "maintenance" if any(word in lowered for word in ["слом", "кран", "окно"]) else "medical",
            "location": None,
            "description": text,
            "priority": "high",
            "assigned_to": "Завхоз" if any(word in lowered for word in ["слом", "кран", "окно"]) else "Медработник",
        }
        intent = "incident" if intent == "general" else "mixed"
        summary = "Определен инцидент."

    if any(word in lowered for word in ["заболел", "не будет", "замена", "заменить", "отсутствует"]):
        lesson_match = re.search(r"(\d+)\s*урок", lowered)
        substitution_request = {
            "absent_teacher": text.split(",")[0].strip() or None,
            "lesson": int(lesson_match.group(1)) if lesson_match else None,
            "class_name": class_match.group(1).upper() if class_match else None,
            "day": "Дүйсенбі",
            "subject": None,
        }
        intent = "substitution" if intent == "general" else "mixed"
        summary = "Определен запрос на замену."

    if any(word in lowered for word in ["приказ", "отчет", "отчёт", "форма", "76", "110", "130"]):
        matched_code = next((code for code in document_codes if code in lowered), None)
        document_request = {
            "document_code": matched_code,
            "goal": "Подготовить документ",
            "details": text,
        }
        intent = "document_request" if intent == "general" else "mixed"
        summary = "Определен запрос на документ."

    if not attendance and not incident and not substitution_request and not document_request:
        for name in staff_names:
            if not name:
                continue
            parts = name.split()
            token = parts[0]
            if token and re.search(rf"\b{re.escape(token)}\b", text, flags=re.IGNORECASE):
                cleaned = re.sub(rf"\b{re.escape(token)}\b", "", text, flags=re.IGNORECASE).strip(" ,.-")
                if cleaned:
                    tasks.append(
                        {
                            "title": cleaned,
                            "assignee": token,
                            "deadline": "Не указан",
                            "priority": "normal",
                        }
                    )
        if tasks:
            intent = "task_batch"
            summary = f"Определено задач: {len(tasks)}."

    return {
        "intent": intent,
        "summary": summary,
        "attendance": attendance,
        "incident": incident,
        "tasks": tasks,
        "substitution_request": substitution_request,
        "document_request": document_request,
        "followup_questions": [],
    }
