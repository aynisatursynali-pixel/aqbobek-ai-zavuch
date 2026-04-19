"""
Архитектура персонала школы Aqbobek
Поддерживает все категории сотрудников согласно требованиям
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime
import json


class StaffCategory(Enum):
    """Категории персонала школы"""
    ADMINISTRATION = "administration"
    TEACHING = "teaching"
    PSYCHOLOGICAL = "psychological"
    EDUCATIONAL_SUPPORT = "educational_support"
    SERVICE = "service"
    TECHNICAL = "technical"
    SECURITY = "security"


class StaffRole(Enum):
    """Роли сотрудников"""
    # Администрация
    DIRECTOR = "директор"
    DEPUTY_DIRECTOR_UVR = "заместитель директора по УВР"
    DEPUTY_DIRECTOR_VR = "заместитель директора по ВР"
    DEPUTY_DIRECTOR_AKHCH = "заместитель директора по АХЧ"
    
    # Педагогические работники
    SUBJECT_TEACHER = "учитель-предметник"
    CLASS_TEACHER = "классный руководитель"
    TUTOR = "воспитатель"
    SENIOR_TUTOR = "старший воспитатель"
    
    # Специалисты социально-психологической службы
    SCHOOL_PSYCHOLOGIST = "педагог-психолог"
    SOCIAL_PEDAGOGUE = "социальный педагог"
    SPEECH_THERAPIST = "учитель-логопед"
    DEFECTOLOGIST = "учитель-дефектолог"
    
    # Учебно-вспомогательный персонал
    TUTOR_MENTOR = "тьютор (наставник)"
    PEDAGOGICAL_ORGANIZER = "педагог-организатор"
    LIBRARIAN = "библиотекарь"
    IT_SPECIALIST = "IT-специалист"
    LABORATORY_ASSISTANT = "лаборант"
    
    # Обслуживающий персонал
    SECRETARY = "секретарь"
    ACCOUNTANT = "бухгалтер"
    CANTEEN_WORKER = "работник столовой"
    TECHNICAL_STAFF = "технический персонал"
    JANITOR = "уборщик"
    SECURITY_GUARD = "охранник"


class IncidentType(Enum):
    """Типы инцидентов с маршрутизацией"""
    MEDICAL = "medical"
    FACILITIES = "facilities"
    BEHAVIOR = "behavior"
    SAFETY = "safety"
    ACADEMIC = "academic"
    OTHER = "other"


class IncidentPriority(Enum):
    """Приоритеты инцидентов"""
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class TaskPriority(Enum):
    """Приоритеты задач"""
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class TaskCategory(Enum):
    """Категории задач"""
    PREPARATION = "preparation"
    LOGISTICS = "logistics"
    ADMINISTRATIVE = "administrative"
    MAINTENANCE = "maintenance"
    EDUCATIONAL = "educational"
    REPORTING = "reporting"


@dataclass
class StaffMember:
    """Модель сотрудника"""
    id: str
    full_name: str
    category: StaffCategory
    role: StaffRole
    specialization: List[str] = field(default_factory=list)
    qualifications: List[str] = field(default_factory=list)
    experience_years: int = 0
    phone: str = ""
    email: str = ""
    telegram_chat_id: Optional[str] = None
    room_number: Optional[str] = None
    is_active: bool = True
    hire_date: Optional[datetime] = None
    
    # Расширенные поля для разных категорий
    weekly_hours_limit: int = 40
    current_workload: Dict[str, int] = field(default_factory=dict)
    skills: List[str] = field(default_factory=list)
    schedule_preferences: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Incident:
    """Модель инцидента"""
    id: str
    type: IncidentType
    priority: IncidentPriority
    title: str
    description: str
    reported_by: str
    reported_at: datetime
    status: str = "new"
    resolution: Optional[str] = None
    related_tasks: List[str] = field(default_factory=list)
    
    # Маршрутизация по типу инцидента
    routing_rules: Dict[str, List[str]] = field(default_factory=dict)
    location: Optional[str] = None
    assigned_to: Optional[str] = None


@dataclass
class Task:
    """Модель задачи"""
    id: str
    title: str
    assignee: str
    creator: str
    category: TaskCategory
    priority: TaskPriority
    created_at: datetime
    status: str = "new"
    updated_at: Optional[datetime] = None
    
    # Источник задачи
    source: str = "manual"
    source_details: Dict[str, Any] = field(default_factory=dict)
    
    # Связанные сущности
    description: Optional[str] = None
    deadline: Optional[str] = None
    
    # Связанные сущности
    related_incident_id: Optional[str] = None
    related_voice_command_id: Optional[str] = None


@dataclass
class Substitution:
    """Модель замены"""
    id: str
    absent_teacher_id: str
    subject: str
    class_name: str
    lesson_number: int
    day: str
    created_at: datetime
    status: str = "pending"  # pending, approved, rejected, completed
    
    # Кандидаты на замену
    candidates: List[Dict[str, Any]] = field(default_factory=list)
    selected_candidate: Optional[Dict[str, Any]] = None
    
    # Метаданные
    substitute_teacher_id: Optional[str] = None
    room: Optional[str] = None
    approved_by: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class ScheduleSlot:
    """Слот расписания для любой сущности"""
    id: str
    entity_type: str  # staff, classroom, student_group
    entity_id: str
    day: str
    lesson_number: int
    time_start: str
    time_end: str
    subject: Optional[str] = None
    room: Optional[str] = None
    student_group: Optional[str] = None
    
    # Для разных типов расписаний
    activity_type: str = "lesson"  # lesson, duty, break, meeting
    activity_title: Optional[str] = None


class StaffArchitecture:
    """Класс для управления архитектурой персонала"""
    
    def __init__(self):
        self.staff_members: List[StaffMember] = []
        self.incidents: List[Incident] = []
        self.tasks: List[Task] = []
        self.substitutions: List[Substitution] = []
        self.schedule_slots: List[ScheduleSlot] = []
    
    def load_from_existing_data(self, teachers_file: str, staff_file: str):
        """Загрузка существующих данных и расширение архитектуры"""
        from data_loader import load_json
        
        # Загрузка существующих учителей
        existing_teachers = load_json(teachers_file, [])
        for teacher_data in existing_teachers:
            staff_member = StaffMember(
                id=f"teacher_{teacher_data.get('teacher_name', '').replace(' ', '_')}",
                full_name=teacher_data.get('teacher_name', ''),
                category=StaffCategory.TEACHING,
                role=StaffRole.SUBJECT_TEACHER,
                specialization=teacher_data.get('subjects', []),
                weekly_hours_limit=teacher_data.get('weekly_load', 40),
                is_active=teacher_data.get('status', 'active') == 'active'
            )
            self.staff_members.append(staff_member)
        
        # Загрузка расширенного персонала если существует
        staff_data = load_json(staff_file, [])
        for staff_item in staff_data:
            staff_member = StaffMember(
                id=staff_item.get('id', ''),
                full_name=staff_item.get('full_name', ''),
                category=StaffCategory(staff_item.get('category', 'teaching')),
                role=StaffRole(staff_item.get('role', 'subject_teacher')),
                specialization=staff_item.get('specialization', []),
                qualifications=staff_item.get('qualifications', []),
                experience_years=staff_item.get('experience_years', 0),
                phone=staff_item.get('phone', ''),
                email=staff_item.get('email', ''),
                telegram_chat_id=staff_item.get('telegram_chat_id'),
                room_number=staff_item.get('room_number'),
                is_active=staff_item.get('is_active', True),
                weekly_hours_limit=staff_item.get('weekly_hours_limit', 40),
                current_workload=staff_item.get('workload_hours', {}),
                skills=staff_item.get('skills', []),
                schedule_preferences=staff_item.get('schedule_preferences', {})
            )
            self.staff_members.append(staff_member)
    
    def get_staff_by_category(self, category: StaffCategory) -> List[StaffMember]:
        """Получить сотрудников по категории"""
        return [staff for staff in self.staff_members if staff.category == category]
    
    def get_staff_by_role(self, role: StaffRole) -> List[StaffMember]:
        """Получить сотрудников по роли"""
        return [staff for staff in self.staff_members if staff.role == role]
    
    def get_active_staff(self) -> List[StaffMember]:
        """Получить активных сотрудников"""
        return [staff for staff in self.staff_members if staff.is_active]
    
    def find_staff_by_name(self, name: str) -> Optional[StaffMember]:
        """Найти сотрудника по имени"""
        for staff in self.staff_members:
            if name.lower() in staff.full_name.lower():
                return staff
        return None
    
    def get_incident_routing(self, incident_type: IncidentType) -> List[str]:
        """Получить маршрутизацию для инцидента"""
        routing_rules = {
            IncidentType.MEDICAL: ["педагог-психолог", "социальный педагог", "медработник"],
            IncidentType.FACILITIES: ["заместитель директора по АХЧ", "технический персонал", "завхоз"],
            IncidentType.BEHAVIOR: ["заместитель директора по ВР", "педагог-психолог", "социальный педагог"],
            IncidentType.SAFETY: ["директор", "охранник", "заместитель директора по АХЧ"],
            IncidentType.ACADEMIC: ["заместитель директора по УВР", "учитель-предметник"],
            IncidentType.OTHER: ["директор", "заместители директора"]
        }
        return routing_rules.get(incident_type, ["директор"])
    
    def create_incident(self, incident_data: Dict[str, Any]) -> Incident:
        """Создать инцидент с маршрутизацией"""
        incident = Incident(
            id=incident_data.get('id', f"inc_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
            type=IncidentType(incident_data.get('type', 'other')),
            priority=IncidentPriority(incident_data.get('priority', 'normal')),
            title=incident_data.get('title', ''),
            description=incident_data.get('description', ''),
            location=incident_data.get('location'),
            reported_by=incident_data.get('reported_by', ''),
            reported_at=datetime.now(),
            assigned_to=incident_data.get('assigned_to'),
            status=incident_data.get('status', 'new')
        )
        
        # Добавить маршрутизацию
        incident.routing_rules = {
            'suggested_assignees': self.get_incident_routing(incident.type)
        }
        
        self.incidents.append(incident)
        return incident
    
    def create_task_from_incident(self, incident: Incident, task_data: Dict[str, Any]) -> Task:
        """Создать задачу из инцидента"""
        task = Task(
            id=task_data.get('id', f"task_{datetime.now().strftime('%Y%m%d_%H%M%S')}"),
            title=task_data.get('title', ''),
            description=task_data.get('description'),
            assignee=task_data.get('assignee', ''),
            creator=incident.reported_by,
            category=TaskCategory(task_data.get('category', 'administrative')),
            priority=TaskPriority(task_data.get('priority', 'normal')),
            deadline=task_data.get('deadline'),
            created_at=datetime.now(),
            source="incident",
            source_details={'incident_id': incident.id},
            related_incident_id=incident.id
        )
        
        self.tasks.append(task)
        return task
    
    def export_to_json(self) -> Dict[str, Any]:
        """Экспортировать архитектуру в JSON"""
        return {
            'staff_members': [
                {
                    'id': sm.id,
                    'full_name': sm.full_name,
                    'category': sm.category.value,
                    'role': sm.role.value,
                    'specialization': sm.specialization,
                    'qualifications': sm.qualifications,
                    'experience_years': sm.experience_years,
                    'phone': sm.phone,
                    'email': sm.email,
                    'telegram_chat_id': sm.telegram_chat_id,
                    'room_number': sm.room_number,
                    'is_active': sm.is_active,
                    'weekly_hours_limit': sm.weekly_hours_limit,
                    'workload_hours': sm.current_workload,
                    'skills': sm.skills,
                    'schedule_preferences': sm.schedule_preferences
                }
                for sm in self.staff_members
            ],
            'incidents': [
                {
                    'id': inc.id,
                    'type': inc.type.value,
                    'priority': inc.priority.value,
                    'title': inc.title,
                    'description': inc.description,
                    'location': inc.location,
                    'reported_by': inc.reported_by,
                    'reported_at': inc.reported_at.isoformat(),
                    'assigned_to': inc.assigned_to,
                    'status': inc.status,
                    'resolution': inc.resolution,
                    'related_tasks': inc.related_tasks,
                    'routing_rules': inc.routing_rules
                }
                for inc in self.incidents
            ],
            'tasks': [
                {
                    'id': task.id,
                    'title': task.title,
                    'description': task.description,
                    'assignee': task.assignee,
                    'creator': task.creator,
                    'category': task.category.value,
                    'priority': task.priority.value,
                    'deadline': task.deadline,
                    'status': task.status,
                    'created_at': task.created_at.isoformat(),
                    'updated_at': task.updated_at.isoformat() if task.updated_at else None,
                    'source': task.source,
                    'source_details': task.source_details,
                    'related_incident_id': task.related_incident_id,
                    'related_voice_command_id': task.related_voice_command_id
                }
                for task in self.tasks
            ]
        }


# Глобальный экземпляр архитектуры
staff_architecture = StaffArchitecture()
