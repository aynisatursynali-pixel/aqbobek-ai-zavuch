"""
Продвинутый NLP парсер для WhatsApp сообщений с детекцией инцидентов и маршрутизацией
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass
from staff_architecture import (
    StaffArchitecture, StaffCategory, StaffRole, 
    IncidentType, IncidentPriority, TaskCategory
)


@dataclass
class ParsedMessage:
    """Результат парсинга сообщения"""
    intent: str
    confidence: float
    entities: Dict[str, Any]
    raw_text: str
    timestamp: datetime
    suggested_actions: List[Dict[str, Any]]


class EnhancedNLPParser:
    """Продвинутый парсер с детекцией инцидентов и маршрутизацией"""
    
    def __init__(self):
        self.staff_arch = StaffArchitecture()
        self.staff_arch.load_from_existing_data(
            "data/teachers.json", 
            "data/staff_extended.json"
        )
        
        # Словари для детекции
        self.incident_keywords = {
            IncidentType.MEDICAL: {
                'primary': ['кровь', 'травм', 'болит', 'голов', 'живот', 'температура', 'рвота', 'обморок', 'сердце', 'давление'],
                'secondary': ['мед', 'здоров', 'больн', 'лекарь', 'скорая'],
                'urgency_indicators': ['кровь', 'травм', 'обморок', 'сердце']
            },
            IncidentType.FACILITIES: {
                'primary': ['слом', 'кран', 'окно', 'дверь', 'парта', 'стул', 'компьютер', 'проектор', 'свет', 'розетка', 'труба'],
                'secondary': ['ремонт', 'почин', 'замен', 'тех', 'оборуд'],
                'urgency_indicators': ['затоп', 'протекает', 'нет света', 'нет воды']
            },
            IncidentType.BEHAVIOR: {
                'primary': ['драка', 'ссора', 'конфликт', 'агресс', 'дерется', 'плачет', 'кричит', 'бьет'],
                'secondary': ['поведение', 'конфликт', 'ссор', 'агрессия', 'психолог'],
                'urgency_indicators': ['драка', 'бьет', 'агресс', 'оружие']
            },
            IncidentType.SAFETY: {
                'primary': ['дым', 'пожар', 'газ', 'запах', 'опасность', 'угроза', 'террор', 'бомба'],
                'secondary': ['безопасность', 'эвакуация', 'пожарная', 'охрана'],
                'urgency_indicators': ['пожар', 'дым', 'газ', 'угроза', 'террор']
            },
            IncidentType.ACADEMIC: {
                'primary': ['экзамен', 'контрольная', 'аттестация', 'оценка', 'проверка', 'списывание'],
                'secondary': ['учеба', 'знания', 'оценка', 'экзамен', 'контроль'],
                'urgency_indicators': ['экзамен', 'аттестация', 'проверка']
            }
        }
        
        # Ключевые слова для задач
        self.task_keywords = {
            TaskCategory.PREPARATION: ['подготовь', 'сделай', 'составь', 'напиши', 'проверь', 'посмотри'],
            TaskCategory.LOGISTICS: ['купи', 'принеси', 'закажи', 'доставь', 'забери', 'привези'],
            TaskCategory.ADMINISTRATIVE: ['отчет', 'приказ', 'документ', 'бумага', 'форма', 'согласуй'],
            TaskCategory.MAINTENANCE: ['почини', 'отремонтируй', 'устрани', 'замени', 'почисть'],
            TaskCategory.EDUCATIONAL: ['проведи', 'организуй', 'преподай', 'проверь', 'проконтролируй'],
            TaskCategory.REPORTING: ['отчет', 'доклад', 'информация', 'статистика', 'анализ']
        }
        
        # Паттерны для attendance
        self.attendance_patterns = [
            r'(\d+[А-Я]\d*)\s*-\s*(\d+)\s*(?:детей|учеников|человек)',
            r'(\d+[А-Я]\d*)\s*[:]\s*(\d+)\s*(?:болеют|отсутствуют)',
            r'(\d+[А-Я]\d*)\s*\((\d+)\s*(?:болеют|отсутствуют)\)',
            r'присутствует\s*(\d+)\s*из\s*(\d+)'
        ]
        
        # Паттерны для замен
        self.substitution_patterns = [
            r'(\w+(?:\s+\w+)*)\s*(?:заболел|не будет|отсутствует|болеет)',
            r'замена\s+(?:учителя|преподавателя)\s+(\w+(?:\s+\w+)*)',
            r'урок\s+(\d+)\s+(?:нужна|требуется)\s+замена'
        ]
        
        # Паттерны для документов
        self.document_patterns = [
            r'(?:приказ|отчет|отчёт)\s*№?\s*(\d+)',
            r'нужен\s+(\d+)\s*(?:приказ|отчет|документ)',
            r'подготов(?:ить|ь)\s+(?:приказ|отчет|документ|форму)'
        ]
    
    def parse_message(self, text: str) -> ParsedMessage:
        """Основной метод парсинга сообщения"""
        normalized_text = text.lower().strip()
        
        # 1. Проверка на attendance
        attendance_result = self._parse_attendance(normalized_text, text)
        if attendance_result:
            return ParsedMessage(
                intent="attendance",
                confidence=attendance_result['confidence'],
                entities=attendance_result['entities'],
                raw_text=text,
                timestamp=datetime.now(),
                suggested_actions=attendance_result['actions']
            )
        
        # 2. Проверка на инциденты
        incident_result = self._parse_incident(normalized_text, text)
        if incident_result:
            return ParsedMessage(
                intent="incident",
                confidence=incident_result['confidence'],
                entities=incident_result['entities'],
                raw_text=text,
                timestamp=datetime.now(),
                suggested_actions=incident_result['actions']
            )
        
        # 3. Проверка на замены
        substitution_result = self._parse_substitution(normalized_text, text)
        if substitution_result:
            return ParsedMessage(
                intent="substitution",
                confidence=substitution_result['confidence'],
                entities=substitution_result['entities'],
                raw_text=text,
                timestamp=datetime.now(),
                suggested_actions=substitution_result['actions']
            )
        
        # 4. Проверка на документы
        document_result = self._parse_document_request(normalized_text, text)
        if document_result:
            return ParsedMessage(
                intent="document_request",
                confidence=document_result['confidence'],
                entities=document_result['entities'],
                raw_text=text,
                timestamp=datetime.now(),
                suggested_actions=document_result['actions']
            )
        
        # 5. Проверка на задачи
        task_result = self._parse_tasks(normalized_text, text)
        if task_result:
            return ParsedMessage(
                intent="task_batch",
                confidence=task_result['confidence'],
                entities=task_result['entities'],
                raw_text=text,
                timestamp=datetime.now(),
                suggested_actions=task_result['actions']
            )
        
        # 6. Общее сообщение
        return ParsedMessage(
            intent="general",
            confidence=0.3,
            entities={'text': text},
            raw_text=text,
            timestamp=datetime.now(),
            suggested_actions=[{'action': 'manual_review', 'reason': 'unclear_intent'}]
        )
    
    def _parse_attendance(self, normalized_text: str, original_text: str) -> Optional[Dict]:
        """Парсинг attendance отчетов"""
        for pattern in self.attendance_patterns:
            match = re.search(pattern, normalized_text)
            if match:
                try:
                    groups = match.groups()
                    if len(groups) >= 2:
                        class_name = self._extract_class_name(original_text)
                        if class_name:
                            present = int(groups[0]) if groups[0].isdigit() else None
                            total = int(groups[1]) if groups[1].isdigit() else None
                            
                            if present and total and present <= total:
                                absent = total - present
                                
                                # Детекция больных и оправданных
                                sick = self._extract_sick_count(normalized_text)
                                excused = self._extract_excused_count(normalized_text)
                                report_time = self._extract_time(normalized_text)
                                
                                return {
                                    'confidence': 0.9,
                                    'entities': {
                                        'class_name': class_name,
                                        'present': present,
                                        'absent': absent,
                                        'sick': sick,
                                        'excused': excused,
                                        'report_time': report_time,
                                        'notes': original_text
                                    },
                                    'actions': [
                                        {
                                            'action': 'save_attendance',
                                            'data': {
                                                'class_name': class_name,
                                                'present': present,
                                                'absent': absent,
                                                'sick': sick,
                                                'excused': excused,
                                                'report_time': report_time
                                            }
                                        }
                                    ]
                                }
                except (ValueError, IndexError):
                    continue
        return None
    
    def _parse_incident(self, normalized_text: str, original_text: str) -> Optional[Dict]:
        """Парсинг инцидентов с детекцией типа и приоритета"""
        best_match = None
        best_score = 0
        
        for incident_type, keywords in self.incident_keywords.items():
            score = 0
            
            # Проверка основных ключевых слов
            for keyword in keywords['primary']:
                if keyword in normalized_text:
                    score += 3
            
            # Проверка вторичных ключевых слов
            for keyword in keywords['secondary']:
                if keyword in normalized_text:
                    score += 1
            
            # Проверка индикаторов срочности
            urgency_boost = 0
            for urgency_keyword in keywords['urgency_indicators']:
                if urgency_keyword in normalized_text:
                    urgency_boost += 2
                    break
            
            total_score = score + urgency_boost
            
            if total_score > best_score:
                best_score = total_score
                best_match = {
                    'type': incident_type,
                    'score': total_score,
                    'urgency': urgency_boost > 0
                }
        
        if best_match and best_score >= 2:
            # Определение приоритета
            priority = self._determine_incident_priority(best_match['type'], best_match['urgency'])
            
            # Извлечение локации
            location = self._extract_location(normalized_text)
            
            # Маршрутизация
            suggested_assignees = self.staff_arch.get_incident_routing(best_match['type'])
            
            return {
                'confidence': min(0.9, 0.3 + (best_score / 10)),
                'entities': {
                    'type': best_match['type'].value,
                    'priority': priority.value,
                    'location': location,
                    'description': original_text,
                    'urgency': 'immediate' if best_match['urgency'] else 'normal',
                    'suggested_assignees': suggested_assignees
                },
                'actions': [
                    {
                        'action': 'create_incident',
                        'data': {
                            'type': best_match['type'].value,
                            'priority': priority.value,
                            'location': location,
                            'description': original_text,
                            'urgency': 'immediate' if best_match['urgency'] else 'normal',
                            'suggested_assignees': suggested_assignees
                        }
                    },
                    {
                        'action': 'notify_staff',
                        'data': {
                            'assignees': suggested_assignees,
                            'message': f"Инцидент: {best_match['type'].value} - {original_text}"
                        }
                    }
                ]
            }
        
        return None
    
    def _parse_substitution(self, normalized_text: str, original_text: str) -> Optional[Dict]:
        """Парсинг запросов на замену"""
        for pattern in self.substitution_patterns:
            match = re.search(pattern, normalized_text)
            if match:
                try:
                    groups = match.groups()
                    absent_teacher = groups[0] if groups else self._extract_teacher_name(original_text)
                    lesson = int(groups[1]) if len(groups) > 1 and groups[1].isdigit() else None
                    
                    # Извлечение предмета и класса
                    subject = self._extract_subject(original_text)
                    class_name = self._extract_class_name(original_text)
                    day = self._extract_day(normalized_text)
                    
                    return {
                        'confidence': 0.8,
                        'entities': {
                            'absent_teacher': absent_teacher,
                            'lesson': lesson,
                            'subject': subject,
                            'class_name': class_name,
                            'day': day or self._get_current_day(),
                            'notes': original_text
                        },
                        'actions': [
                            {
                                'action': 'find_substitutes',
                                'data': {
                                    'subject': subject,
                                    'lesson': lesson,
                                    'class_name': class_name,
                                    'day': day or self._get_current_day()
                                }
                            },
                            {
                                'action': 'notify_substitution_system',
                                'data': {
                                    'message': f"Запрос на замену: {absent_teacher}"
                                }
                            }
                        ]
                    }
                except (ValueError, IndexError):
                    continue
        return None
    
    def _parse_document_request(self, normalized_text: str, original_text: str) -> Optional[Dict]:
        """Парсинг запросов документов"""
        for pattern in self.document_patterns:
            match = re.search(pattern, normalized_text)
            if match:
                try:
                    groups = match.groups()
                    doc_code = groups[0] if groups else self._extract_document_code(normalized_text)
                    
                    # Определение цели документа
                    goal = self._extract_document_goal(normalized_text)
                    
                    return {
                        'confidence': 0.85,
                        'entities': {
                            'document_code': doc_code,
                            'goal': goal,
                            'details': original_text
                        },
                        'actions': [
                            {
                                'action': 'prepare_document',
                                'data': {
                                    'code': doc_code,
                                    'goal': goal,
                                    'details': original_text
                                }
                            }
                        ]
                    }
                except (ValueError, IndexError):
                    continue
        return None
    
    def _parse_tasks(self, normalized_text: str, original_text: str) -> Optional[Dict]:
        """Парсинг задач с определением категорий"""
        tasks = []
        
        # Извлечение упоминаний сотрудников
        mentioned_staff = self._extract_mentioned_staff(original_text)
        
        if mentioned_staff:
            for staff_member in mentioned_staff:
                # Определение категории задачи
                category = self._determine_task_category(normalized_text)
                priority = self._determine_task_priority(normalized_text)
                deadline = self._extract_deadline(normalized_text)
                
                # Извлечение текста задачи для этого сотрудника
                task_text = self._extract_task_for_staff(original_text, staff_member['full_name'])
                
                if task_text:
                    tasks.append({
                        'title': task_text,
                        'assignee': staff_member['full_name'],
                        'category': category.value,
                        'priority': priority.value,
                        'deadline': deadline,
                        'confidence': 0.8
                    })
        
        if tasks:
            return {
                'confidence': 0.8,
                'entities': {
                    'tasks': tasks,
                    'total_tasks': len(tasks),
                    'notes': original_text
                },
                'actions': [
                    {
                        'action': 'create_tasks',
                        'data': {
                            'tasks': tasks
                        }
                    }
                ]
            }
        
        return None
    
    def _extract_class_name(self, text: str) -> Optional[str]:
        """Извлечение названия класса"""
        class_pattern = r'\b([1-9][А-Я]\d*)\b'
        match = re.search(class_pattern, text)
        return match.group(1) if match else None
    
    def _extract_sick_count(self, text: str) -> Optional[int]:
        """Извлечение количества больных"""
        patterns = [
            r'(\d+)\s*(?:болеют|больн|болеет)',
            r'болеют\s*(\d+)',
            r'больн\s*(\d+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return int(match.group(1))
        return None
    
    def _extract_excused_count(self, text: str) -> Optional[int]:
        """Извлечение количества оправданных"""
        patterns = [
            r'(\d+)\s*(?:уваж|оправд)',
            r'уваж\s*(\d+)',
            r'оправд\s*(\d+)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return int(match.group(1))
        return None
    
    def _extract_time(self, text: str) -> Optional[str]:
        """Извлечение времени"""
        time_patterns = [
            r'(\d{1,2}:\d{2})',
            r'в\s*(\d{1,2})\s*час',
            r'(\d{1,2})\s*час'
        ]
        
        for pattern in time_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)
        return None
    
    def _extract_location(self, text: str) -> Optional[str]:
        """Извлечение локации инцидента"""
        location_patterns = [
            r'кабинет\s*(\d+)',
            r'класс\s*([А-Я]\d*)',
            r'(?:спортзал|столовая|коридор|туалет|библиотека|актовый зал)',
            r'(\d+)\s*кабинет'
        ]
        
        for pattern in location_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(0) if match.groups() else match.group(0)
        return None
    
    def _extract_teacher_name(self, text: str) -> Optional[str]:
        """Извлечение имени учителя"""
        # Сначала пытаемся найти точное совпадение
        for staff in self.staff_arch.get_active_staff():
            if staff.full_name.lower() in text.lower():
                return staff.full_name
        
        # Если не нашли, пытаемся извлечь по частям имени
        words = text.split()
        for staff in self.staff_arch.get_active_staff():
            name_parts = staff.full_name.lower().split()
            for name_part in name_parts:
                if name_part in words:
                    return staff.full_name
        
        return None
    
    def _extract_mentioned_staff(self, text: str) -> List[Dict]:
        """Извлечение упомянутых сотрудников"""
        mentioned = []
        
        for staff in self.staff_arch.get_active_staff():
            # Проверяем полное имя
            if staff.full_name.lower() in text.lower():
                mentioned.append({
                    'full_name': staff.full_name,
                    'role': staff.role.value,
                    'category': staff.category.value,
                    'match_type': 'full_name'
                })
                continue
            
            # Проверяем части имени
            name_parts = staff.full_name.lower().split()
            for name_part in name_parts:
                if name_part in text.lower() and len(name_part) > 2:  # Избегаем коротких совпадений
                    mentioned.append({
                        'full_name': staff.full_name,
                        'role': staff.role.value,
                        'category': staff.category.value,
                        'match_type': 'partial_name'
                    })
                    break
        
        return mentioned
    
    def _extract_subject(self, text: str) -> Optional[str]:
        """Извлечение предмета"""
        subjects = ['математика', 'русский', 'казахский', 'английский', 'физика', 'химия', 
                   'биология', 'история', 'география', 'информатика', 'литература']
        
        for subject in subjects:
            if subject in text.lower():
                return subject.capitalize()
        return None
    
    def _extract_day(self, text: str) -> Optional[str]:
        """Извлечение дня недели"""
        days = {
            'дүйсенбі': 'Дүйсенбі',
            'сейсенбі': 'Сейсенбі', 
            'сәрсенбі': 'Сәрсенбі',
            'бейсенбі': 'Бейсенбі',
            'жұма': 'Жұма',
            'сенбі': 'Сенбі',
            'понедельник': 'Дүйсенбі',
            'вторник': 'Сейсенбі',
            'среда': 'Сәрсенбі',
            'четверг': 'Бейсенбі',
            'пятница': 'Жұма',
            'суббота': 'Сенбі'
        }
        
        for day_key, day_value in days.items():
            if day_key in text.lower():
                return day_value
        
        return None
    
    def _extract_document_code(self, text: str) -> Optional[str]:
        """Извлечение кода документа"""
        doc_patterns = [
            r'(\d+)',
            r'приказ\s*№?\s*(\d+)',
            r'документ\s*№?\s*(\d+)'
        ]
        
        for pattern in doc_patterns:
            match = re.search(pattern, text)
            if match:
                code = match.group(1)
                # Проверяем стандартные коды
                if code in ['76', '110', '130']:
                    return code
                return code
        return None
    
    def _extract_document_goal(self, text: str) -> str:
        """Определение цели документа"""
        goal_keywords = {
            'хакатон': 'Организовать хакатон',
            'конкурс': 'Провести конкурс',
            'собрание': 'Созвать собрание',
            'отчет': 'Подготовить отчет',
            'отчёт': 'Подготовить отчёт',
            'приказ': 'Подготовить приказ',
            'документ': 'Подготовить документ',
            'форму': 'Подготовить форму'
        }
        
        for keyword, goal in goal_keywords.items():
            if keyword in text.lower():
                return goal
        
        return 'Подготовить документ'
    
    def _extract_task_for_staff(self, text: str, staff_name: str) -> Optional[str]:
        """Извлечение текста задачи для конкретного сотрудника"""
        # Удаляем имя сотрудника из текста
        cleaned_text = text.replace(staff_name, '').strip()
        
        # Удаляем лишние символы
        cleaned_text = re.sub(r'^[,\.\-:]+', '', cleaned_text)
        cleaned_text = re.sub(r'[,\.\-:]+$', '', cleaned_text)
        
        return cleaned_text if cleaned_text else None
    
    def _determine_task_category(self, text: str) -> TaskCategory:
        """Определение категории задачи"""
        for category, keywords in self.task_keywords.items():
            for keyword in keywords:
                if keyword in text.lower():
                    return category
        return TaskCategory.ADMINISTRATIVE
    
    def _determine_task_priority(self, text: str) -> TaskPriority:
        """Определение приоритета задачи"""
        high_priority_keywords = ['срочно', 'немедленно', 'важно', 'критично', 'сегодня']
        low_priority_keywords = ['когда-нибудь', 'позже', 'не срочно']
        
        for keyword in high_priority_keywords:
            if keyword in text.lower():
                return TaskPriority.HIGH
        
        for keyword in low_priority_keywords:
            if keyword in text.lower():
                return TaskPriority.LOW
        
        return TaskPriority.NORMAL
    
    def _determine_incident_priority(self, incident_type: IncidentType, is_urgent: bool) -> IncidentPriority:
        """Определение приоритета инцидента"""
        if is_urgent:
            return IncidentPriority.CRITICAL
        
        priority_map = {
            IncidentType.MEDICAL: IncidentPriority.HIGH,
            IncidentType.SAFETY: IncidentPriority.CRITICAL,
            IncidentType.BEHAVIOR: IncidentPriority.HIGH,
            IncidentType.FACILITIES: IncidentPriority.NORMAL,
            IncidentType.ACADEMIC: IncidentPriority.NORMAL
        }
        
        return priority_map.get(incident_type, IncidentPriority.NORMAL)
    
    def _extract_deadline(self, text: str) -> str:
        """Извлечение срока выполнения"""
        deadline_patterns = {
            'сегодня': 'Сегодня',
            'завтра': 'Завтра',
            'на неделе': 'На этой неделе',
            'неделя': 'На этой неделе'
        }
        
        for pattern, deadline in deadline_patterns.items():
            if pattern in text.lower():
                return deadline
        
        # Проверяем время
        time_match = re.search(r'(\d{1,2}:\d{2})', text)
        if time_match:
            return f"Сегодня до {time_match.group(1)}"
        
        return 'Не указан'
    
    def _get_current_day(self) -> str:
        """Получение текущего дня недели"""
        days = ['Дүйсенбі', 'Сейсенбі', 'Сәрсенбі', 'Бейсенбі', 'Жұма', 'Сенбі']
        current_day = datetime.now().weekday()
        return days[current_day] if 0 <= current_day < 6 else 'Дүйсенбі'


# Глобальный экземпляр парсера
enhanced_parser = EnhancedNLPParser()
