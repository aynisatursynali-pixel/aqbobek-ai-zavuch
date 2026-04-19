from flask import Flask, jsonify, request, send_from_directory
import importlib
import sys

from config import FRONTEND_DIR
from data_loader import load_json, save_json
from gemini_ai import analyze_school_message, generate_document_copilot, get_gemini_status
from school_ops import (
    EXPECTED_CLASSES,
    apply_ai_analysis,
    append_incident,
    append_unique_task,
    build_attendance_summary,
    build_people_catalog,
    build_personal_schedule,
    build_schedule_conflicts,
    build_schedule_insights,
    build_staff_plans,
    get_audit,
    get_notifications,
    load_regulations,
    normalize_task,
    now_str,
    propose_substitution,
    regulation_search,
    update_incident_status_by_index,
    update_substitution_status_by_index,
    update_task_status_by_index,
)

try:
    from staff_architecture import staff_architecture as staff_arch
except ImportError:
    staff_arch = None

try:
    from enhanced_nlp_parser import enhanced_parser
except ImportError:
    enhanced_parser = None

try:
    from incident_management import incident_manager
except ImportError:
    incident_manager = None

try:
    from knowledge_base import knowledge_base_rag
except ImportError:
    knowledge_base_rag = None

try:
    voice_task_manager = importlib.import_module("voice_processor").voice_task_manager
except Exception:
    voice_task_manager = None


app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/api/attendance", methods=["GET"])
def get_attendance():
    return jsonify(load_json("attendance_reports.json", []))


@app.route("/api/attendance/summary", methods=["GET"])
def get_attendance_summary():
    return jsonify(build_attendance_summary())


@app.route("/api/incidents", methods=["GET"])
def get_incidents():
    return jsonify(load_json("incidents.json", []))


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    return jsonify(load_json("tasks.json", []))


@app.route("/api/substitutions", methods=["GET"])
def get_substitutions():
    return jsonify(load_json("substitutions.json", []))


@app.route("/api/teachers", methods=["GET"])
def get_teachers():
    return jsonify(load_json("teachers.json", []))


@app.route("/api/staff", methods=["GET"])
def get_staff():
    return jsonify(load_json("staff_directory.json", []))


@app.route("/api/notifications", methods=["GET"])
def notifications():
    limit = int(request.args.get("limit", 30))
    return jsonify(get_notifications(limit=limit))


@app.route("/api/audit", methods=["GET"])
def audit():
    limit = int(request.args.get("limit", 50))
    return jsonify(get_audit(limit=limit))


@app.route("/api/regulations", methods=["GET"])
def get_regulations():
    return jsonify(load_regulations())


@app.route("/api/ai/status", methods=["GET"])
def ai_status():
    status = get_gemini_status()
    status["expected_classes"] = EXPECTED_CLASSES
    return jsonify(status)


@app.route("/api/schedule", methods=["GET"])
def get_schedule():
    data = load_json("master_schedule.json", [])
    day = request.args.get("day")
    class_name = request.args.get("class")
    teacher = request.args.get("teacher")
    room = request.args.get("room")

    result = data

    if day:
        result = [item for item in result if str(item.get("day", "")).lower() == day.lower()]

    if class_name:
        result = [item for item in result if str(item.get("class", "")).upper() == class_name.upper()]

    if teacher:
        teacher_lower = teacher.lower()
        result = [item for item in result if teacher_lower in str(item.get("subject_teacher", "")).lower()]

    if room:
        room_lower = room.lower()
        result = [item for item in result if room_lower in str(item.get("room", "")).lower()]

    return jsonify(result)


@app.route("/api/schedule/insights", methods=["GET"])
def get_schedule_insights():
    day = request.args.get("day")
    return jsonify(build_schedule_insights(day=day))


@app.route("/api/schedule/conflicts", methods=["GET"])
def get_schedule_conflicts():
    day = request.args.get("day")
    return jsonify(build_schedule_conflicts(day=day))


@app.route("/api/people/<path:person_name>/schedule", methods=["GET"])
def get_person_schedule(person_name):
    day = request.args.get("day")
    return jsonify(build_personal_schedule(person_name, day=day))


@app.route("/api/staff/plans", methods=["GET"])
def get_staff_plans():
    day = request.args.get("day")
    return jsonify(build_staff_plans(day=day))


@app.route("/api/people", methods=["GET"])
def get_people():
    return jsonify(build_people_catalog())


@app.route("/api/tasks", methods=["POST"])
def create_task():
    body = request.json or {}
    task = normalize_task(
        {
            "title": str(body.get("title", "")).strip(),
            "assignee": str(body.get("assignee", "")).strip(),
            "deadline": str(body.get("deadline", "Не указан")).strip(),
            "priority": str(body.get("priority", "normal")).strip(),
        },
        source=str(body.get("source", "dashboard_manual")).strip() or "dashboard_manual",
    )

    if not task["title"] or not task["assignee"]:
        return jsonify({"ok": False, "error": "title and assignee required"}), 400

    append_unique_task(task)
    return jsonify({"ok": True, "task": task})


@app.route("/api/tasks/<int:index>/status", methods=["PATCH"])
def update_task_status(index):
    body = request.json or {}
    task = update_task_status_by_index(index, str(body.get("status", "new")))
    if not task:
        return jsonify({"ok": False, "error": "task not found"}), 404
    return jsonify({"ok": True, "task": task})


@app.route("/api/incidents", methods=["POST"])
def create_incident():
    body = request.json or {}
    incident = {
        "text": str(body.get("text", "")).strip(),
        "type": str(body.get("type", "other")).strip(),
        "status": str(body.get("status", "new")).strip(),
        "action": str(body.get("action", "awaiting_fix")).strip(),
        "assigned_to": str(body.get("assigned_to", "Администрация")).strip(),
        "priority": str(body.get("priority", "normal")).strip(),
        "created_at": now_str(),
    }

    if not incident["text"]:
        return jsonify({"ok": False, "error": "text required"}), 400

    append_incident(incident)
    return jsonify({"ok": True, "incident": incident})


@app.route("/api/incidents/<int:index>/status", methods=["PATCH"])
def update_incident_status(index):
    body = request.json or {}
    incident = update_incident_status_by_index(index, str(body.get("status", "new")))
    if not incident:
        return jsonify({"ok": False, "error": "incident not found"}), 404
    return jsonify({"ok": True, "incident": incident})


@app.route("/api/substitutions/<int:index>/status", methods=["PATCH"])
def update_substitution_status(index):
    body = request.json or {}
    substitution = update_substitution_status_by_index(index, str(body.get("status", "proposed")))
    if not substitution:
        return jsonify({"ok": False, "error": "substitution not found"}), 404
    return jsonify({"ok": True, "substitution": substitution})


@app.route("/api/substitutions/propose", methods=["POST"])
def create_substitution():
    body = request.json or {}
    record = propose_substitution(body)
    if not record:
        return jsonify({"ok": False, "error": "day, lesson and class are required"}), 400
    return jsonify({"ok": True, "substitution": record})


@app.route("/api/ai/process", methods=["POST"])
def ai_process():
    body = request.json or {}
    text = str(body.get("text", "")).strip()
    source = str(body.get("source", "dashboard_ai")).strip() or "dashboard_ai"
    persist = bool(body.get("persist", True))

    if not text:
        return jsonify({"ok": False, "error": "text required"}), 400

    people = build_people_catalog()
    analysis = analyze_school_message(
        text,
        expected_classes=EXPECTED_CLASSES,
        staff_names=[item.get("display_name") or item.get("name") or item.get("role") for item in people],
        document_codes=[str(item.get("code")) for item in load_regulations()],
    )
    result = apply_ai_analysis(analysis, source=source, persist=persist)
    return jsonify({"ok": True, **result, "ai_status": get_gemini_status()})


@app.route("/api/regulations/assist", methods=["POST"])
def regulations_assist():
    body = request.json or {}
    query = str(body.get("query", "")).strip()
    document_code = str(body.get("document_code", "")).strip() or None

    if not query:
        return jsonify({"ok": False, "error": "query required"}), 400

    snippets = regulation_search(query, selected_code=document_code, limit=4)

    try:
        result = generate_document_copilot(
            query,
            selected_document=document_code or "auto",
            snippets=snippets,
        )
        return jsonify({"ok": True, "result": result, "ai_status": get_gemini_status()})
    except Exception as error:
        fallback = {
            "document_title": f"Черновик по документу {document_code or 'auto'}",
            "plain_summary": "AI-модуль временно недоступен, поэтому показаны retrieved chunks и список того, что нужно уточнить.",
            "missing_information": [
                "дата и основание приказа",
                "список ответственных лиц",
                "сроки исполнения",
            ],
            "action_checklist": [
                "уточнить тип документа",
                "проверить сроки и ответственных",
                "согласовать финальный текст с директором",
            ],
            "draft_text": f"Черновик: {query}",
            "teacher_friendly_explanation": "Ниже показан базовый черновик. После восстановления AI можно перегенерировать документ в более точной форме.",
            "sources": [
                {
                    "code": item.get("code"),
                    "title": item.get("title"),
                    "section": item.get("section"),
                    "excerpt": item.get("excerpt"),
                    "source_url": item.get("source_url"),
                }
                for item in snippets
            ],
            "error": str(error),
        }
        return jsonify({"ok": True, "result": fallback, "ai_status": get_gemini_status()})


@app.route("/api/clear", methods=["POST"])
def clear_data():
    body = request.json or {}
    target = body.get("target")

    allowed = {
        "tasks": "tasks.json",
        "incidents": "incidents.json",
        "attendance": "attendance_reports.json",
        "substitutions": "substitutions.json",
        "notifications": "notifications.json",
    }

    if target not in allowed:
        return jsonify({"ok": False, "error": "invalid target"}), 400

    save_json(allowed[target], [])
    return jsonify({"ok": True})


@app.route("/api/nlp/process", methods=["POST"])
def process_message_with_enhanced_nlp():
    """Обработка сообщения с продвинутым NLP парсером"""
    body = request.json or {}
    message_text = str(body.get("message", "")).strip()
    reporter = str(body.get("reporter", "system"))
    
    if not message_text:
        return jsonify({"ok": False, "error": "message required"}), 400
    
    try:
        result = enhanced_parser.parse_message(message_text)
        
        # Обработка результатов парсинга
        actions_taken = []
        
        if result.intent == "incident":
            incident_result = incident_manager.process_message(
                message_text, reporter
            )
            actions_taken.append(incident_result)
        elif result.intent == "task_batch":
            # Создание задач через архитектуру персонала
            for task_data in result.entities.get('tasks', []):
                task = staff_arch.create_task_from_data(task_data)
                if task:
                    staff_arch.tasks.append(task)
                    actions_taken.append({
                        "action": "task_created",
                        "task_id": task.id,
                        "title": task.title
                    })
        
        return jsonify({
            "ok": True,
            "parsed": result,
            "actions_taken": actions_taken,
            "message": f"Обработано: {result.intent}"
        })
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


@app.route("/api/voice/process", methods=["POST"])
def process_voice_command_enhanced():
    """Обработка голосовой команды с интеграцией реальных данных"""
    body = request.json or {}
    transcript = str(body.get("transcript", "")).strip()
    confidence = float(body.get("confidence", 0.0))
    
    if not transcript:
        return jsonify({"ok": False, "error": "transcript required"}), 400
    
    try:
        result = voice_task_manager.process_voice_command(transcript, confidence)
        return jsonify(result)
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


@app.route("/api/voice/history", methods=["GET"])
def get_voice_command_history():
    """Получение истории голосовых команд"""
    limit = int(request.args.get("limit", 20))
    
    try:
        history = voice_task_manager.get_voice_commands_history(limit)
        return jsonify({"ok": True, "history": history})
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


@app.route("/api/voice/suggestions", methods=["POST"])
def get_voice_suggestions():
    """Получение предложений по голосовой команде"""
    body = request.json or {}
    partial_transcript = str(body.get("partial_transcript", "")).strip()
    
    if not partial_transcript:
        return jsonify({"ok": False, "error": "partial_transcript required"}), 400
    
    try:
        suggestions = voice_task_manager.get_task_suggestions(partial_transcript)
        return jsonify({"ok": True, "suggestions": suggestions})
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


@app.route("/api/incidents", methods=["GET", "POST"])
def manage_incidents():
    """Управление инцидентами"""
    if request.method == "GET":
        try:
            incidents = incident_manager.get_active_incidents()
            return jsonify({"ok": True, "incidents": incidents})
        except Exception as error:
            return jsonify({"ok": False, "error": str(error)}), 500
    
    elif request.method == "POST":
        body = request.json or {}
        action = body.get("action")
        incident_id = body.get("incident_id")
        
        if not action or not incident_id:
            return jsonify({"ok": False, "error": "action and incident_id required"}), 400
    
    try:
        if action == "resolve":
            resolution = str(body.get("resolution", ""))
            resolved_by = str(body.get("resolved_by", ""))
            result = incident_manager.resolve_incident(incident_id, resolution, resolved_by)
        elif action == "escalate":
            reason = str(body.get("reason", ""))
            escalated_by = str(body.get("escalated_by", ""))
            result = incident_manager.escalate_incident(incident_id, reason, escalated_by)
        else:
            return jsonify({"ok": False, "error": "Invalid action"}), 400
    
        return jsonify(result)
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


@app.route("/api/tasks", methods=["GET", "POST"])
def manage_tasks():
    """Управление задачами"""
    if request.method == "GET":
        try:
            tasks = staff_arch.tasks
            return jsonify({"ok": True, "tasks": [
                {
                    "id": task.id,
                    "title": task.title,
                    "description": task.description,
                    "assignee": task.assignee,
                    "category": task.category.value,
                    "priority": task.priority.value,
                    "deadline": task.deadline,
                    "status": task.status,
                    "created_at": task.created_at.isoformat(),
                    "updated_at": task.updated_at.isoformat() if task.updated_at else None,
                    "source": task.source,
                    "source_details": task.source_details,
                    "related_voice_command_id": task.related_voice_command_id
                } for task in tasks
            ]})
        except Exception as error:
            return jsonify({"ok": False, "error": str(error)}), 500
    
    elif request.method == "POST":
        body = request.json or {}
        action = body.get("action")
        task_id = body.get("task_id")
        
        if not action or not task_id:
            return jsonify({"ok": False, "error": "action and task_id required"}), 400
    
    try:
        if action == "update_status":
            new_status = str(body.get("status", ""))
            result = voice_task_manager.update_task_status(task_id, new_status)
        else:
            return jsonify({"ok": False, "error": "Invalid action"}), 400
    
        return jsonify(result)
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


@app.route("/api/school/staff", methods=["GET"])
def get_school_staff():
    """Получение списка всего персонала школы"""
    try:
        staff_arch.load_from_existing_data(
                "data/teachers.json", 
                "data/staff_extended.json"
            )
        
        return jsonify({"ok": True, "staff": [
                {
                    "id": member.id,
                    "full_name": member.full_name,
                    "category": member.category.value,
                    "role": member.role.value,
                    "specialization": member.specialization,
                    "qualifications": member.qualifications,
                    "experience_years": member.experience_years,
                    "phone": member.phone,
                    "email": member.email,
                    "telegram_chat_id": member.telegram_chat_id,
                    "room_number": member.room_number,
                    "is_active": member.is_active,
                    "weekly_hours_limit": member.weekly_hours_limit,
                    "workload_hours": member.current_workload,
                    "skills": member.skills,
                    "schedule_preferences": member.schedule_preferences
                } for member in staff_arch.staff_members
            ]})
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


@app.route("/api/school/statistics", methods=["GET"])
def get_school_statistics():
    """Получение статистики по школе"""
    try:
        staff_arch.load_from_existing_data(
                "data/teachers.json", 
                "data/staff_extended.json"
            )
        
        # Базовая статистика
        total_staff = len(staff_arch.staff_members)
        active_staff = len(staff_arch.get_active_staff())
        total_incidents = len(incident_manager.incidents)
        total_tasks = len(staff_arch.tasks)
        total_voice_commands = len(voice_task_manager.voice_commands)
        
        # Статистика по категориям
        by_category = {}
        for member in staff_arch.staff_members:
            category = member.category.value
            by_category[category] = by_category.get(category, 0) + 1
        
        by_role = {}
        for member in staff_arch.staff_members:
            role = member.role.value
            by_role[role] = by_role.get(role, 0) + 1
        
        return jsonify({"ok": True, "statistics": {
                "total_staff": total_staff,
                "active_staff": active_staff,
                "total_incidents": total_incidents,
                "total_tasks": total_tasks,
                "total_voice_commands": total_voice_commands,
                "by_category": by_category,
                "by_role": by_role
            }
        })
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500


if __name__ == "__main__":
    port = 5000
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            try:
                port = int(sys.argv[idx + 1])
            except ValueError:
                pass

    if __name__ == "__main__":
        app.run(host="0.0.0.0", port=port, debug=True)

@app.route("/api/knowledge/search", methods=["POST"])
def search_knowledge():
    """Поиск в базе знаний с RAG"""
    body = request.json or {}
    query_text = str(body.get("query", "")).strip()
    query_type = str(body.get("query_type", "search"))
    filters = body.get("filters", {})
    max_results = int(body.get("max_results", 5))
    
    if not query_text:
        return jsonify({"ok": False, "error": "query required"}), 400
    
    try:
        from knowledge_base import KnowledgeQuery
        
        query = KnowledgeQuery(
            query=query_text,
            context=body.get("context"),
            query_type=query_type,
            filters=filters,
            max_results=max_results,
            include_metadata=True
        )
        
        result = knowledge_base_rag.search_knowledge(query)
        return jsonify({
            "ok": True,
            "query": query_text,
            "results": result.relevant_chunks,
            "generated_content": result.generated_content,
            "suggestions": result.suggestions,
            "confidence": result.confidence,
            "sources": result.sources,
            "processing_time": result.processing_time
        })
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500

@app.route("/api/knowledge/templates", methods=["GET"])
def get_knowledge_templates():
    """Получение шаблонов документов"""
    try:
        templates = knowledge_base_rag.get_document_templates()
        return jsonify({
            "ok": True,
            "templates": [
                {
                    "id": template.id,
                    "name": template.name,
                    "category": template.category,
                    "description": template.description,
                    "template_fields": template.template_fields,
                    "required_roles": template.required_roles,
                    "approval_required": template.approval_required,
                    "estimated_time": template.estimated_time,
                    "tags": template.tags
                } for template in templates
            ]
        })
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500

@app.route("/api/knowledge/document", methods=["POST"])
def create_knowledge_document():
    """Создание документа в базе знаний"""
    body = request.json or {}
    
    if not body:
        return jsonify({"ok": False, "error": "document data required"}), 400
    
    try:
        result = knowledge_base_rag.add_document(body)
        return jsonify(result)
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500

@app.route("/api/knowledge/statistics", methods=["GET"])
def get_knowledge_statistics():
    """Получение статистики базы знаний"""
    try:
        stats = knowledge_base_rag.get_knowledge_statistics()
        return jsonify({
            "ok": True,
            "statistics": stats
        })
    except Exception as error:
        return jsonify({"ok": False, "error": str(error)}), 500

if __name__ == "__main__":
    port = 5000
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            try:
                port = int(sys.argv[idx + 1])
            except ValueError:
                pass
    app.run(host="0.0.0.0", port=port, debug=True)
