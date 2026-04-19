"""
Система управления инцидентами с интеллектуальной маршрутизацией
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import json

from staff_architecture import (
    StaffArchitecture, StaffMember, Incident, IncidentType, 
    IncidentPriority, Task, TaskCategory
)
from enhanced_nlp_parser import enhanced_parser
from data_loader import load_json, save_json
from storage import append_audit_log, append_notification
from datetime import datetime


@dataclass
class IncidentWorkflow:
    """Рабочий процесс инцидента"""
    incident_id: str
    current_status: str
    assigned_to: Optional[str] = None
    resolution_deadline: Optional[datetime] = None
    auto_resolved: bool = False
    created_tasks: List[str] = field(default_factory=list)
    notifications_sent: List[str] = field(default_factory=list)
    escalation_level: int = 0  # 0: normal, 1: escalated, 2: critical escalation


@dataclass
class IncidentResolution:
    """Результат решения инцидента"""
    incident_id: str
    resolution_type: str  # auto_resolved, manual_resolved, escalated
    resolved_by: str
    resolved_at: datetime
    resolution_description: str
    follow_up_required: bool = False
    follow_up_deadline: Optional[datetime] = None


class IncidentManager:
    """Менеджер инцидентов с интеллектуальной маршрутизацией"""
    
    def __init__(self):
        self.staff_arch = StaffArchitecture()
        self.staff_arch.load_from_existing_data(
            "data/teachers.json", 
            "data/staff_extended.json"
        )
        self.incidents = []
        self.workflows = {}
        self.resolutions = []
        
        # Загрузка существующих инцидентов
        self._load_existing_incidents()
    
    def _load_existing_incidents(self):
        """Загрузка существующих инцидентов"""
        existing_incidents = load_json("incidents.json", [])
        
        for incident_data in existing_incidents:
            incident = Incident(
                id=incident_data.get('id', ''),
                type=IncidentType(incident_data.get('type', 'other')),
                priority=IncidentPriority(incident_data.get('priority', 'normal')),
                title=incident_data.get('title', ''),
                description=incident_data.get('text', ''),
                location=incident_data.get('location'),
                reported_by=incident_data.get('reported_by', ''),
                reported_at=datetime.fromisoformat(incident_data.get('created_at', '')) if incident_data.get('created_at') else datetime.now(),
                assigned_to=incident_data.get('assigned_to'),
                status=incident_data.get('status', 'new')
            )
            self.incidents.append(incident)
            
            # Создание рабочего процесса
            workflow = IncidentWorkflow(
                incident_id=incident.id,
                current_status=incident.status,
                assigned_to=incident.assigned_to
            )
            self.workflows[incident.id] = workflow
    
    def process_message(self, message_text: str, reporter: str = "system") -> Dict[str, Any]:
        """Обработка сообщения и создание инцидента при необходимости"""
        
        # Парсинг сообщения
        parsed = enhanced_parser.parse_message(message_text)
        
        if parsed.intent == "incident":
            return self._create_incident_from_parsed(parsed, reporter)
        elif parsed.intent == "mixed":
            # Обработка смешанных сообщений
            results = []
            for action in parsed.suggested_actions:
                if action.get('action') == 'create_incident':
                    incident_result = self._create_incident_from_data(action['data'], reporter)
                    results.append(incident_result)
            return {
                'success': True,
                'incidents_created': len(results),
                'results': results,
                'message': f"Создано {len(results)} инцидентов"
            }
        
        return {'success': False, 'message': 'Инцидент не обнаружен'}
    
    def _create_incident_from_parsed(self, parsed, reporter: str) -> Dict[str, Any]:
        """Создание инцидента из распарсенных данных"""
        incident_data = parsed.entities
        incident_type = IncidentType(incident_data['type'])
        
        # Создание инцидента
        incident = self.staff_arch.create_incident(incident_data)
        self.incidents.append(incident)
        
        # Создание рабочего процесса
        workflow = self._create_workflow(incident)
        self.workflows[incident.id] = workflow
        
        # Автоматическое создание задач при необходимости
        created_tasks = []
        if self._should_create_tasks(incident):
            task_data = {
                'title': f"Обработка инцидента: {incident.title}",
                'description': incident.description,
                'assignee': incident.assigned_to or self._get_primary_assignee(incident_type),
                'category': 'maintenance' if incident_type == IncidentType.FACILITIES else 'administrative',
                'priority': incident.priority.value,
                'deadline': self._calculate_deadline(incident)
            }
            
            task = self.staff_arch.create_task_from_incident(incident, task_data)
            self.staff_arch.tasks.append(task)
            created_tasks.append(task.id)
            workflow.created_tasks.append(task.id)
        
        # Сохранение
        self._save_incidents()
        self._save_workflows()
        
        # Логирование
        append_audit_log(
            "incident_created",
            "incident",
            f"Создан инцидент: {incident.title}",
            {
                'incident_id': incident.id,
                'type': incident.type.value,
                'priority': incident.priority.value,
                'assigned_to': incident.assigned_to,
                'auto_tasks_created': len(created_tasks)
            },
            created_at=now_str()
        )
        
        # Уведомления
        self._send_incident_notifications(incident, workflow)
        
        return {
            'success': True,
            'incident_id': incident.id,
            'incident': {
                'id': incident.id,
                'type': incident.type.value,
                'priority': incident.priority.value,
                'title': incident.title,
                'description': incident.description,
                'location': incident.location,
                'reported_by': incident.reported_by,
                'status': incident.status,
                'assigned_to': incident.assigned_to,
                'created_at': incident.reported_at.isoformat(),
                'routing_suggestions': incident.routing_rules.get('suggested_assignees', [])
            },
            'workflow': {
                'id': workflow.incident_id,
                'status': workflow.current_status,
                'assigned_to': workflow.assigned_to,
                'escalation_level': workflow.escalation_level,
                'auto_resolved': workflow.auto_resolved,
                'created_tasks': created_tasks
            }
        }
    
    def _create_incident_from_data(self, incident_data: Dict, reporter: str) -> Incident:
        """Создание инцидента из данных"""
        incident = Incident(
            id=incident_data.get('id', f"inc_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
            type=IncidentType(incident_data['type']),
            priority=IncidentPriority(incident_data['priority']),
            title=incident_data.get('title', ''),
            description=incident_data.get('description', ''),
            location=incident_data.get('location'),
            reported_by=reporter,
            reported_at=datetime.now(),
            assigned_to=incident_data.get('assigned_to'),
            status=incident_data.get('status', 'new')
        )
        
        # Добавление маршрутизации
        incident.routing_rules = {
            'suggested_assignees': self.staff_arch.get_incident_routing(incident.type)
        }
        
        return incident
    
    def _create_workflow(self, incident: Incident) -> IncidentWorkflow:
        """Создание рабочего процесса для инцидента"""
        workflow = IncidentWorkflow(
            incident_id=incident.id,
            current_status=incident.status,
            assigned_to=incident.assigned_to,
            resolution_deadline=self._calculate_resolution_deadline(incident),
            auto_resolved=self._can_auto_resolve(incident)
        )
        
        return workflow
    
    def _should_create_tasks(self, incident: Incident) -> bool:
        """Определение необходимости создания задач"""
        # Создавать задачи для всех инцидентов кроме low priority
        return incident.priority != IncidentPriority.LOW
    
    def _get_primary_assignee(self, incident_type: IncidentType) -> str:
        """Получение основного исполнителя для типа инцидента"""
        suggested = self.staff_arch.get_incident_routing(incident_type)
        return suggested[0] if suggested else "директор"
    
    def _calculate_deadline(self, incident: Incident) -> str:
        """Расчет срока выполнения"""
        base_deadline = datetime.now()
        
        if incident.priority == IncidentPriority.CRITICAL:
            deadline = base_deadline + timedelta(hours=2)
            return "В течение 2 часов"
        elif incident.priority == IncidentPriority.HIGH:
            deadline = base_deadline + timedelta(hours=8)
            return "В течение 8 часов"
        elif incident.priority == IncidentPriority.NORMAL:
            deadline = base_deadline + timedelta(days=1)
            return "В течение дня"
        else:
            deadline = base_deadline + timedelta(days=3)
            return "В течение 3 дней"
    
    def _calculate_resolution_deadline(self, incident: Incident) -> datetime:
        """Расчет дедлайна решения инцидента"""
        base_deadline = datetime.now()
        
        if incident.priority == IncidentPriority.CRITICAL:
            return base_deadline + timedelta(hours=4)
        elif incident.priority == IncidentPriority.HIGH:
            return base_deadline + timedelta(hours=24)
        elif incident.priority == IncidentPriority.NORMAL:
            return base_deadline + timedelta(days=2)
        else:
            return base_deadline + timedelta(days=7)
    
    def _can_auto_resolve(self, incident: Incident) -> bool:
        """Определение возможности автоматического решения"""
        # Автоматически решаем только низкоприоритетные инциденты
        if incident.priority == IncidentPriority.LOW:
            # Проверяем на простые проблемы
            simple_keywords = ['свет', 'розетка', 'дверь', 'окно', 'мусор']
            description_lower = incident.description.lower()
            return any(keyword in description_lower for keyword in simple_keywords)
        
        return False
    
    def _send_incident_notifications(self, incident: Incident, workflow: IncidentWorkflow):
        """Отправка уведомлений об инциденте"""
        # Уведомление назначенному сотруднику
        if incident.assigned_to:
            append_notification(
                f"🚨 Новый инцидент: {incident.title}",
                f"Тип: {incident.type.value}\nПриоритет: {incident.priority.value}\nЛокация: {incident.location or 'Не указана'}\nОписание: {incident.description}",
                audience=incident.assigned_to,
                tone="critical",
                payload={
                    'incident_id': incident.id,
                    'type': 'incident_assigned',
                    'priority': incident.priority.value
                }
            )
            workflow.notifications_sent.append(incident.assigned_to)
        
        # Уведомление администрации
        admin_roles = ['директор', 'заместитель директора по УВР', 'заместитель директора по ВР']
        for role in admin_roles:
            staff_members = self.staff_arch.get_staff_by_role(StaffRole(role))
            for staff in staff_members:
                if staff.telegram_chat_id:
                    append_notification(
                        f"📋 Инцидент назначен: {incident.title}",
                        f"Исполнитель: {incident.assigned_to or 'Не назначен'}\nТип: {incident.type.value}",
                        audience=staff.telegram_chat_id,
                        tone="neutral",
                        payload={
                            'incident_id': incident.id,
                            'type': 'incident_notification'
                        }
                    )
        
        # Уведомление всем предложенным исполнителям
        suggested = incident.routing_rules.get('suggested_assignees', [])
        for assignee in suggested:
            append_notification(
                f"💡 Предложение по инциденту: {incident.title}",
                f"Вам предложен инцидент типа {incident.type.value}",
                audience=assignee,
                tone="neutral",
                payload={
                    'incident_id': incident.id,
                    'type': 'incident_suggestion'
                }
            )
    
    def get_incident_statistics(self) -> Dict[str, Any]:
        """Получение статистики по инцидентам"""
        if not self.incidents:
            return {
                'total_incidents': 0,
                'by_type': {},
                'by_priority': {},
                'by_status': {},
                'resolution_time_avg': 0,
                'auto_resolution_rate': 0
            }
        
        # Статистика по типам
        type_stats = {}
        for incident in self.incidents:
            type_name = incident.type.value
            type_stats[type_name] = type_stats.get(type_name, 0) + 1
        
        # Статистика по приоритетам
        priority_stats = {}
        for incident in self.incidents:
            priority_name = incident.priority.value
            priority_stats[priority_name] = priority_stats.get(priority_name, 0) + 1
        
        # Статистика по статусам
        status_stats = {}
        for incident in self.incidents:
            status_name = incident.status
            status_stats[status_name] = status_stats.get(status_name, 0) + 1
        
        # Автоматическое решение
        auto_resolved_count = sum(1 for workflow in self.workflows.values() if workflow.auto_resolved)
        auto_resolution_rate = (auto_resolved_count / len(self.workflows)) * 100 if self.workflows else 0
        
        return {
            'total_incidents': len(self.incidents),
            'by_type': type_stats,
            'by_priority': priority_stats,
            'by_status': status_stats,
            'auto_resolution_rate': round(auto_resolution_rate, 2),
            'active_workflows': len([w for w in self.workflows.values() if w.current_status not in ['resolved', 'closed']]),
            'total_workflows': len(self.workflows)
        }
    
    def escalate_incident(self, incident_id: str, reason: str, escalated_by: str) -> Dict[str, Any]:
        """Эскалация инцидента"""
        if incident_id not in self.workflows:
            return {'success': False, 'error': 'Workflow not found'}
        
        workflow = self.workflows[incident_id]
        workflow.escalation_level += 1
        workflow.current_status = 'escalated'
        
        # Логирование эскалации
        append_audit_log(
            "incident_escalated",
            "incident",
            f"Инцидент {incident_id} эскалирован",
            {
                'incident_id': incident_id,
                'escalation_level': workflow.escalation_level,
                'reason': reason,
                'escalated_by': escalated_by
            },
            created_at=now_str()
        )
        
        # Уведомление об эскалации
        append_notification(
            f"🔥 ЭСКАЛАЦИЯ ИНЦИДЕНТА",
            f"Инцидент {incident_id} эскалирован на уровень {workflow.escalation_level}\nПричина: {reason}",
            audience="директор",
            tone="critical",
            payload={
                'incident_id': incident_id,
                'type': 'incident_escalation',
                'escalation_level': workflow.escalation_level
            }
        )
        
        self._save_workflows()
        
        return {
            'success': True,
            'incident_id': incident_id,
            'escalation_level': workflow.escalation_level,
            'message': f"Инцидент эскалирован на уровень {workflow.escalation_level}"
        }
    
    def resolve_incident(self, incident_id: str, resolution: str, resolved_by: str) -> Dict[str, Any]:
        """Решение инцидента"""
        if incident_id not in self.workflows:
            return {'success': False, 'error': 'Workflow not found'}
        
        workflow = self.workflows[incident_id]
        workflow.current_status = 'resolved'
        
        # Создание записи о решении
        resolution_record = IncidentResolution(
            incident_id=incident_id,
            resolution_type='manual_resolved',
            resolved_by=resolved_by,
            resolved_at=datetime.now(),
            resolution_description=resolution
        )
        
        self.resolutions.append(resolution_record)
        
        # Логирование решения
        append_audit_log(
            "incident_resolved",
            "incident",
            f"Инцидент {incident_id} решен",
            {
                'incident_id': incident_id,
                'resolution_type': 'manual_resolved',
                'resolved_by': resolved_by,
                'resolution_description': resolution
            },
            created_at=now_str()
        )
        
        # Уведомление о решении
        append_notification(
            f"✅ ИНЦИДЕНТ РЕШЕН",
            f"Инцидент {incident_id} решен\nРешение: {resolution}",
            audience="all",
            tone="good",
            payload={
                'incident_id': incident_id,
                'type': 'incident_resolved'
            }
        )
        
        self._save_workflows()
        self._save_resolutions()
        
        return {
            'success': True,
            'incident_id': incident_id,
            'resolution': {
                'type': 'manual_resolved',
                'resolved_by': resolved_by,
                'resolved_at': resolution_record.resolved_at.isoformat(),
                'description': resolution
            }
        }
    
    def get_active_incidents(self) -> List[Dict]:
        """Получение активных инцидентов"""
        active_incidents = []
        
        for incident in self.incidents:
            if incident.status not in ['resolved', 'closed']:
                workflow = self.workflows.get(incident.id)
                active_incidents.append({
                    'id': incident.id,
                    'type': incident.type.value,
                    'priority': incident.priority.value,
                    'title': incident.title,
                    'description': incident.description,
                    'location': incident.location,
                    'reported_by': incident.reported_by,
                    'reported_at': incident.reported_at.isoformat(),
                    'assigned_to': incident.assigned_to,
                    'status': incident.status,
                    'workflow': {
                        'escalation_level': workflow.escalation_level if workflow else 0,
                        'resolution_deadline': workflow.resolution_deadline.isoformat() if workflow and workflow.resolution_deadline else None,
                        'auto_resolved': workflow.auto_resolved if workflow else False,
                        'created_tasks': workflow.created_tasks if workflow else []
                    },
                    'routing_suggestions': incident.routing_rules.get('suggested_assignees', []) if hasattr(incident, 'routing_rules') else []
                })
        
        return active_incidents
    
    def _save_incidents(self):
        """Сохранение инцидентов"""
        incidents_data = [
            {
                'id': inc.id,
                'type': inc.type.value,
                'priority': inc.priority.value,
                'title': inc.title,
                'text': inc.description,
                'location': inc.location,
                'reported_by': inc.reported_by,
                'created_at': inc.reported_at.isoformat(),
                'assigned_to': inc.assigned_to,
                'status': inc.status,
                'routing_rules': inc.routing_rules
            }
            for inc in self.incidents
        ]
        
        save_json("incidents.json", incidents_data)
    
    def _save_workflows(self):
        """Сохранение рабочих процессов"""
        workflows_data = [
            {
                'incident_id': workflow.incident_id,
                'current_status': workflow.current_status,
                'assigned_to': workflow.assigned_to,
                'resolution_deadline': workflow.resolution_deadline.isoformat() if workflow.resolution_deadline else None,
                'auto_resolved': workflow.auto_resolved,
                'created_tasks': workflow.created_tasks,
                'notifications_sent': workflow.notifications_sent,
                'escalation_level': workflow.escalation_level
            }
            for workflow in self.workflows.values()
        ]
        
        save_json("incident_workflows.json", workflows_data)
    
    def _save_resolutions(self):
        """Сохранение решений"""
        resolutions_data = [
            {
                'incident_id': res.incident_id,
                'resolution_type': res.resolution_type,
                'resolved_by': res.resolved_by,
                'resolved_at': res.resolved_at.isoformat(),
                'resolution_description': res.resolution_description,
                'follow_up_required': res.follow_up_required,
                'follow_up_deadline': res.follow_up_deadline.isoformat() if res.follow_up_deadline else None
            }
            for res in self.resolutions
        ]
        
        save_json("incident_resolutions.json", resolutions_data)


# Глобальный экземпляр менеджера инцидентов
incident_manager = IncidentManager()
