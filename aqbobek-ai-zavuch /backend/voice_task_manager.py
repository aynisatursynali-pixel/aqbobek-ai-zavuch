"""
Voice-to-Task менеджер для директора с интеграцией реальных данных персонала
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, field
import json

from staff_architecture import (
    StaffArchitecture, StaffMember, TaskCategory, TaskPriority
)
from data_loader import load_json, save_json
from storage import append_audit_log, append_notification, now_str


@dataclass
class VoiceCommand:
    """Голосовая команда"""
    id: str
    transcript: str
    confidence: float
    created_at: datetime
    processed_at: Optional[datetime] = None
    status: str = "pending"  # pending, processed, failed
    created_tasks: List[str] = field(default_factory=list)
    error_message: Optional[str] = None
    source: str = "voice"


@dataclass
class TaskTemplate:
    """Шаблон задачи для быстрого создания"""
    id: str
    name: str
    description: str
    default_category: TaskCategory
    default_priority: TaskPriority
    estimated_duration: str
    required_role: Optional[str] = None
    auto_assignee_rules: List[str] = field(default_factory=list)


class VoiceTaskManager:
    """Менеджер голосовых задач для директора"""
    
    def __init__(self):
        self.staff_arch = StaffArchitecture()
        self.staff_arch.load_from_existing_data(
            "data/teachers.json", 
            "data/staff_extended.json"
        )
        
        self.voice_commands = []
        self.task_templates = self._load_task_templates()
        self._load_existing_commands()
    
    def _load_task_templates(self) -> List[TaskTemplate]:
        """Загрузка шаблонов задач"""
        templates = [
            TaskTemplate(
                id="meeting_prep",
                name="Подготовка совещания",
                description="Подготовить актовый зал к совещанию",
                default_category=TaskCategory.LOGISTICS,
                default_priority=TaskPriority.HIGH,
                estimated_duration="30 минут",
                required_role="заместитель директора по АХЧ",
                auto_assignee_rules=["АХЧ", "завхоз"]
            ),
            TaskTemplate(
                id="document_prep",
                name="Подготовка документа",
                description="Подготовить приказ/документ",
                default_category=TaskCategory.ADMINISTRATIVE,
                default_priority=TaskPriority.NORMAL,
                estimated_duration="1 час",
                required_role="секретарь",
                auto_assignee_rules=["секретарь", "делопроизводство"]
            ),
            TaskTemplate(
                id="facility_check",
                name="Проверка объекта",
                description="Проверить состояние объекта/помещения",
                default_category=TaskCategory.MAINTENANCE,
                default_priority=TaskPriority.NORMAL,
                estimated_duration="45 минут",
                required_role="заместитель директора по АХЧ",
                auto_assignee_rules=["АХЧ", "технический персонал"]
            ),
            TaskTemplate(
                id="parent_meeting",
                name="Родительское собрание",
                description="Организовать родительское собрание",
                default_category=TaskCategory.EDUCATIONAL,
                default_priority=TaskPriority.HIGH,
                estimated_duration="2 часа",
                required_role="заместитель директора по ВР",
                auto_assignee_rules=["ВР", "классные руководители"]
            ),
            TaskTemplate(
                id="inspection",
                name="Проверка учебного процесса",
                description="Провести проверку учебного процесса",
                default_category=TaskCategory.EDUCATIONAL,
                default_priority=TaskPriority.NORMAL,
                estimated_duration="1 час",
                required_role="заместитель директора по УВР",
                auto_assignee_rules=["УВР", "методисты"]
            ),
            TaskTemplate(
                id="report_preparation",
                name="Подготовка отчета",
                description="Подготовить отчет для вышестоящей организации",
                default_category=TaskCategory.REPORTING,
                default_priority=TaskPriority.NORMAL,
                estimated_duration="2 часа",
                required_role="заместитель директора по УВР",
                auto_assignee_rules=["УВР", "методисты"]
            ),
            TaskTemplate(
                id="emergency_response",
                name="Экстренное реагирование",
                description="Реагировать на экстренную ситуацию",
                default_category=TaskCategory.MAINTENANCE,
                default_priority=TaskPriority.CRITICAL,
                estimated_duration="30 минут",
                required_role="директор",
                auto_assignee_rules=["директор", "охрана", "АХЧ"]
            )
        ]
        
        return templates
    
    def _load_existing_commands(self):
        """Загрузка существующих голосовых команд"""
        try:
            existing_commands = load_json("voice_commands.json", [])
            for cmd_data in existing_commands:
                cmd = VoiceCommand(
                    id=cmd_data.get('id', ''),
                    transcript=cmd_data.get('transcript', ''),
                    confidence=cmd_data.get('confidence', 0.0),
                    created_at=datetime.fromisoformat(cmd_data.get('created_at', '')) if cmd_data.get('created_at') else datetime.now(),
                    processed_at=datetime.fromisoformat(cmd_data.get('processed_at', '')) if cmd_data.get('processed_at') else None,
                    status=cmd_data.get('status', 'pending'),
                    created_tasks=cmd_data.get('created_tasks', []),
                    error_message=cmd_data.get('error_message'),
                    source=cmd_data.get('source', 'voice')
                )
                self.voice_commands.append(cmd)
        except Exception as e:
            print(f"Error loading voice commands: {e}")
    
    def process_voice_command(self, transcript: str, confidence: float = 0.0) -> Dict[str, Any]:
        """Обработка голосовой команды директора"""
        
        # Создание записи о команде
        command = VoiceCommand(
            id=f"voice_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            transcript=transcript,
            confidence=confidence,
            created_at=datetime.now(),
            status="processing"
        )
        
        try:
            # Анализ команды
            analysis_result = self._analyze_command(transcript)
            
            if not analysis_result['success']:
                command.status = "failed"
                command.error_message = analysis_result['error']
                command.processed_at = datetime.now()
                
                self.voice_commands.append(command)
                self._save_commands()
                
                return {
                    'success': False,
                    'error': analysis_result['error'],
                    'command_id': command.id,
                    'transcript': transcript,
                    'confidence': confidence
                }
            
            # Создание задач
            created_tasks = []
            for task_data in analysis_result['tasks']:
                task = self._create_task_from_voice(task_data, transcript)
                if task:
                    created_tasks.append(task.id)
                    self.staff_arch.tasks.append(task)
            
            # Обновление статуса команды
            command.status = "processed"
            command.processed_at = datetime.now()
            command.created_tasks = created_tasks
            
            self.voice_commands.append(command)
            self._save_commands()
            self._save_tasks()
            
            # Логирование
            append_audit_log(
                "voice_command_processed",
                "voice_task",
                f"Обработана голосовая команда: {transcript}",
                {
                    'command_id': command.id,
                    'transcript': transcript,
                    'confidence': confidence,
                    'tasks_created': len(created_tasks),
                    'analysis_result': analysis_result
                },
                created_at=now_str()
            )
            
            # Уведомления
            self._send_voice_notifications(created_tasks)
            
            return {
                'success': True,
                'command_id': command.id,
                'transcript': transcript,
                'confidence': confidence,
                'tasks_created': len(created_tasks),
                'tasks': [
                    {
                        'id': task.id,
                        'title': task.title,
                        'assignee': task.assignee,
                        'category': task.category.value,
                        'priority': task.priority.value,
                        'deadline': task.deadline,
                        'status': task.status
                    }
                    for task in self.staff_arch.tasks[-len(created_tasks):]  # Только созданные задачи
                ],
                'summary': analysis_result.get('summary', f"Создано {len(created_tasks)} задач")
            }
            
        except Exception as e:
            command.status = "failed"
            command.error_message = str(e)
            command.processed_at = datetime.now()
            
            self.voice_commands.append(command)
            self._save_commands()
            
            return {
                'success': False,
                'error': f"Ошибка обработки: {str(e)}",
                'command_id': command.id,
                'transcript': transcript,
                'confidence': confidence
            }
    
    def _analyze_command(self, transcript: str) -> Dict[str, Any]:
        """Анализ голосовой команды"""
        normalized_text = transcript.lower().strip()
        
        # Проверка на шаблоны
        template_match = self._match_template(normalized_text)
        if template_match:
            return template_match
        
        # Извлечение упоминаний сотрудников
        mentioned_staff = self._extract_mentioned_staff(transcript)
        
        # Извлечение задач
        tasks = []
        for staff_member in mentioned_staff:
            task_text = self._extract_task_for_staff(transcript, staff_member.full_name)
            if task_text:
                # Определение категории и приоритета
                category = self._determine_task_category(task_text)
                priority = self._determine_task_priority(task_text)
                deadline = self._extract_deadline(task_text)
                
                tasks.append({
                    'title': task_text,
                    'assignee': staff_member.full_name,
                    'category': category,
                    'priority': priority,
                    'deadline': deadline,
                    'confidence': 0.8
                })
        
        if tasks:
            return {
                'success': True,
                'tasks': tasks,
                'summary': f"Определено задач: {len(tasks)} для {len(mentioned_staff)} сотрудников"
            }
        
        return {
            'success': False,
            'error': 'Не удалось определить задачи или шаблон в команде',
            'transcript': transcript
        }
    
    def _match_template(self, text: str) -> Optional[Dict[str, Any]]:
        """Проверка на соответствие шаблону"""
        template_keywords = {
            "подготовь совещание": "meeting_prep",
            "подготовь встречу": "meeting_prep",
            "подготовь зал": "meeting_prep",
            "подготовь документ": "document_prep",
            "подготовь приказ": "document_prep",
            "подготовь отчет": "report_preparation",
            "проверь объект": "facility_check",
            "проверь кабинет": "facility_check",
            "проверь состояние": "facility_check",
            "родительское собрание": "parent_meeting",
            "собрание родителей": "parent_meeting",
            "проверь учебный процесс": "inspection",
            "проверь уроки": "inspection",
            "экстренная ситуация": "emergency_response",
            "срочно": "emergency_response",
            "авария": "emergency_response"
        }
        
        for keyword, template_id in template_keywords.items():
            if keyword in text:
                template = next((t for t in self.task_templates if t.id == template_id), None)
                if template:
                    # Находим подходящего исполнителя
                    assignee = self._find_best_assignee(template)
                    
                    return {
                        'success': True,
                        'template_id': template_id,
                        'template_name': template.name,
                        'tasks': [{
                            'title': template.description,
                            'assignee': assignee,
                            'category': template.default_category.value,
                            'priority': template.default_priority.value,
                            'deadline': self._calculate_template_deadline(template),
                            'confidence': 0.9
                        }],
                        'summary': f"Применен шаблон: {template.name}"
                    }
        
        return None
    
    def _extract_mentioned_staff(self, text: str) -> List[StaffMember]:
        """Извлечение упомянутых сотрудников"""
        mentioned = []
        text_lower = text.lower()
        
        for staff_member in self.staff_arch.get_active_staff():
            # Проверяем полное имя
            if staff_member.full_name.lower() in text_lower:
                mentioned.append(staff_member)
                continue
            
            # Проверяем части имени
            name_parts = staff_member.full_name.lower().split()
            for name_part in name_parts:
                if len(name_part) > 2 and name_part in text_lower:
                    mentioned.append(staff_member)
                    break
        
        return mentioned
    
    def _extract_task_for_staff(self, text: str, staff_name: str) -> Optional[str]:
        """Извлечение задачи для конкретного сотрудника"""
        # Удаляем имя сотрудника из текста
        cleaned_text = text.replace(staff_name, '').strip()
        
        # Удаляем лишние символы в начале
        cleaned_text = re.sub(r'^[,\.\-:]+', '', cleaned_text)
        cleaned_text = re.sub(r'[,\.\-:]+$', '', cleaned_text)
        
        return cleaned_text if cleaned_text else None
    
    def _determine_task_category(self, task_text: str) -> TaskCategory:
        """Определение категории задачи"""
        text_lower = task_text.lower()
        
        category_keywords = {
            TaskCategory.PREPARATION: ['подготов', 'сделай', 'составь', 'напиши'],
            TaskCategory.LOGISTICS: ['купи', 'принеси', 'закажи', 'доставь', 'забери'],
            TaskCategory.ADMINISTRATIVE: ['отчет', 'документ', 'приказ', 'бумага', 'форма'],
            TaskCategory.MAINTENANCE: ['почини', 'отремонтируй', 'устрани', 'замени', 'почисть'],
            TaskCategory.EDUCATIONAL: ['проверь', 'проконтролируй', 'проведи', 'организуй'],
            TaskCategory.REPORTING: ['отчет', 'доклад', 'статистика', 'анализ']
        }
        
        for category, keywords in category_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return category
        
        return TaskCategory.ADMINISTRATIVE
    
    def _determine_task_priority(self, task_text: str) -> TaskPriority:
        """Определение приоритета задачи"""
        text_lower = task_text.lower()
        
        high_priority_keywords = ['срочно', 'немедленно', 'важно', 'критично', 'сегодня']
        low_priority_keywords = ['когда-нибудь', 'позже', 'не срочно', 'в свободное время']
        
        for keyword in high_priority_keywords:
            if keyword in text_lower:
                return TaskPriority.HIGH
        
        for keyword in low_priority_keywords:
            if keyword in text_lower:
                return TaskPriority.LOW
        
        return TaskPriority.NORMAL
    
    def _extract_deadline(self, text: str) -> str:
        """Извлечение срока выполнения"""
        text_lower = text.lower()
        
        deadline_patterns = {
            'сегодня': 'Сегодня',
            'завтра': 'Завтра',
            'на неделе': 'На этой неделе',
            'неделю': 'На этой неделе'
        }
        
        for pattern, deadline in deadline_patterns.items():
            if pattern in text_lower:
                return deadline
        
        # Проверяем время
        time_match = re.search(r'(\d{1,2}:\d{2})', text)
        if time_match:
            return f"Сегодня до {time_match.group(1)}"
        
        return 'Не указан'
    
    def _find_best_assignee(self, template: TaskTemplate) -> str:
        """Поиск лучшего исполнителя для шаблона"""
        if template.required_role:
            # Ищем сотрудника с указанной ролью
            role_staff = self.staff_arch.get_staff_by_role(
                StaffRole(template.required_role)
            )
            if role_staff:
                # Выбираем сотрудника с наименьшей загрузкой
                best_staff = min(role_staff, key=lambda x: sum(x.current_workload.values()))
                return best_staff.full_name
        
        # Если роль не указана, ищем по правилам
        for rule in template.auto_assignee_rules:
            for staff_member in self.staff_arch.get_active_staff():
                # Проверяем по роли
                if staff_member.role.value.lower() in rule.lower():
                    return staff_member.full_name
                
                # Проверяем по навыкам
                for skill in staff_member.skills:
                    if skill.lower() in rule.lower():
                        return staff_member.full_name
        
        # По умолчанию - директор
        director = self.staff_arch.find_staff_by_name("Айнур Кенжебаев")
        return director.full_name if director else "директор"
    
    def _calculate_template_deadline(self, template: TaskTemplate) -> str:
        """Расчет дедлайна для шаблона"""
        if template.default_priority == TaskPriority.CRITICAL:
            return "В течение 30 минут"
        elif template.default_priority == TaskPriority.HIGH:
            return "В течение 2 часов"
        elif template.default_priority == TaskPriority.NORMAL:
            return "В течение дня"
        else:
            return "В течение 3 дней"
    
    def _create_task_from_voice(self, task_data: Dict, transcript: str) -> Optional[Any]:
        """Создание задачи из голосовой команды"""
        from staff_architecture import Task
        
        task = Task(
            id=f"task_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            title=task_data.get('title', ''),
            description=f"Создано из голосовой команды: {transcript}",
            assignee=task_data.get('assignee', ''),
            creator="директор",
            category=TaskCategory(task_data.get('category', 'administrative')),
            priority=TaskPriority(task_data.get('priority', 'normal')),
            deadline=task_data.get('deadline', 'Не указан'),
            created_at=datetime.now(),
            source="voice",
            source_details={'transcript': transcript, 'confidence': task_data.get('confidence', 0.0)}
        )
        
        return task
    
    def _save_commands(self):
        """Сохранение голосовых команд"""
        commands_data = [
            {
                'id': cmd.id,
                'transcript': cmd.transcript,
                'confidence': cmd.confidence,
                'created_at': cmd.created_at.isoformat(),
                'processed_at': cmd.processed_at.isoformat() if cmd.processed_at else None,
                'status': cmd.status,
                'created_tasks': cmd.created_tasks,
                'error_message': cmd.error_message,
                'source': cmd.source
            }
            for cmd in self.voice_commands
        ]
        
        save_json("voice_commands.json", commands_data)
    
    def _save_tasks(self):
        """Сохранение задач"""
        from staff_architecture import Task
        
        tasks_data = []
        for task in self.staff_arch.tasks:
            tasks_data.append({
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
                'related_voice_command_id': task.related_voice_command_id
            })
        
        save_json("tasks.json", tasks_data)
    
    def _send_voice_notifications(self, created_tasks: List[str]):
        """Отправка уведомлений о созданных задачах"""
        from staff_architecture import Task
        
        for task_id in created_tasks:
            task = next((t for t in self.staff_arch.tasks if t.id == task_id), None)
            if task:
                append_notification(
                    f"🎤 Новая задача из голосовой команды",
                    f"Задача: {task.title}\nИсполнитель: {task.assignee}\nСрок: {task.deadline}",
                    audience=task.assignee,
                    tone="neutral",
                    payload={
                        'task_id': task.id,
                        'source': 'voice_command'
                    }
                )
        
        # Уведомление директору о результате
        append_notification(
            f"📊 Голосовая команда обработана",
            f"Создано задач: {len(created_tasks)}",
            audience="директор",
            tone="good",
            payload={
                'tasks_created': len(created_tasks),
                'source': 'voice_command'
            }
        )
    
    def get_voice_commands_history(self, limit: int = 20) -> List[Dict]:
        """Получение истории голосовых команд"""
        sorted_commands = sorted(
            self.voice_commands, 
            key=lambda x: x.created_at, 
            reverse=True
        )
        
        return [
            {
                'id': cmd.id,
                'transcript': cmd.transcript,
                'confidence': cmd.confidence,
                'created_at': cmd.created_at.isoformat(),
                'processed_at': cmd.processed_at.isoformat() if cmd.processed_at else None,
                'status': cmd.status,
                'created_tasks': cmd.created_tasks,
                'error_message': cmd.error_message,
                'source': cmd.source
            }
            for cmd in sorted_commands[:limit]
        ]
    
    def get_task_suggestions(self, partial_transcript: str) -> List[Dict]:
        """Получение предложений по частичной транскрипции"""
        suggestions = []
        text_lower = partial_transcript.lower()
        
        # Предложения по шаблонам
        for template in self.task_templates:
            for keyword in ["подготов", "сделай", "проверь", "организуй"]:
                if keyword in text_lower:
                    assignee = self._find_best_assignee(template)
                    suggestions.append({
                        'type': 'template',
                        'template_id': template.id,
                        'template_name': template.name,
                        'title': template.description,
                        'assignee': assignee,
                        'category': template.default_category.value,
                        'priority': template.default_priority.value,
                        'confidence': 0.8
                    })
        
        # Предложения по упомянутым сотрудникам
        mentioned_staff = self._extract_mentioned_staff(partial_transcript)
        if mentioned_staff:
            suggestions.append({
                'type': 'staff_mentioned',
                'staff': [
                    {
                        'name': staff.full_name,
                        'role': staff.role.value,
                        'category': staff.category.value
                    }
                    for staff in mentioned_staff[:3]  # Ограничиваем до 3
                ]
            })
        
        return suggestions
    
    def get_voice_statistics(self) -> Dict[str, Any]:
        """Получение статистики по голосовым командам"""
        if not self.voice_commands:
            return {
                'total_commands': 0,
                'successful_commands': 0,
                'failed_commands': 0,
                'total_tasks_created': 0,
                'average_confidence': 0.0,
                'most_active_day': None,
                'top_templates': {}
            }
        
        successful_commands = [cmd for cmd in self.voice_commands if cmd.status == 'processed']
        failed_commands = [cmd for cmd in self.voice_commands if cmd.status == 'failed']
        total_tasks_created = sum(len(cmd.created_tasks) for cmd in successful_commands)
        
        # Самый активный день
        day_counts = {}
        for cmd in self.voice_commands:
            day = cmd.created_at.strftime('%A')
            day_counts[day] = day_counts.get(day, 0) + 1
        
        most_active_day = max(day_counts.items(), key=lambda x: x[1])[0] if day_counts else None
        
        # Самые используемые шаблоны
        template_counts = {}
        for cmd in successful_commands:
            # Анализируем транскрипт для определения шаблона
            transcript_lower = cmd.transcript.lower()
            for template in self.task_templates:
                for keyword in ["подготов", "сделай", "проверь", "организуй"]:
                    if keyword in transcript_lower:
                        template_counts[template.name] = template_counts.get(template.name, 0) + 1
                        break
        
        return {
            'total_commands': len(self.voice_commands),
            'successful_commands': len(successful_commands),
            'failed_commands': len(failed_commands),
            'total_tasks_created': total_tasks_created,
            'average_confidence': sum(cmd.confidence for cmd in self.voice_commands) / len(self.voice_commands),
            'most_active_day': most_active_day,
            'top_templates': template_counts,
            'success_rate': (len(successful_commands) / len(self.voice_commands)) * 100 if self.voice_commands else 0
        }


# Глобальный экземпляр менеджера
voice_task_manager = VoiceTaskManager()
