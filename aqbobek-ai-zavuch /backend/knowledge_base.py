"""
RAG архитектура для базы знаний Aqbobek
Поддерживает подготовку документов, отчетов и административных материалов
"""

import re
import json
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import hashlib

from data_loader import load_json, save_json
from storage import append_audit_log


@dataclass
class KnowledgeChunk:
    """Чанк знаний для RAG"""
    id: str
    document_id: str
    chunk_type: str  # regulation, template, report, instruction
    title: str
    content: str
    created_at: datetime
    metadata: Dict[str, Any] = field(default_factory=dict)
    access_count: int = 0
    last_accessed: Optional[datetime] = None
    embedding: Optional[List[float]] = None


@dataclass
class DocumentTemplate:
    """Шаблон документа"""
    id: str
    name: str
    description: str
    template_fields: List[Dict[str, Any]]
    required_roles: List[str]
    estimated_time: str
    category: str  # administrative, educational, financial, hr
    approval_required: bool = False
    tags: List[str] = field(default_factory=list)


@dataclass
class KnowledgeQuery:
    """Запрос к базе знаний"""
    query: str
    query_type: str  # search, draft, explain, summarize
    context: Optional[str] = None
    filters: Dict[str, Any] = field(default_factory=dict)
    max_results: int = 5
    include_metadata: bool = True


@dataclass
class KnowledgeResponse:
    """Ответ от RAG системы"""
    query: str
    relevant_chunks: List[Dict[str, Any]]
    generated_content: Optional[str] = None
    suggestions: List[str] = field(default_factory=list)
    confidence: float = 0.0
    sources: List[str] = field(default_factory=list)
    processing_time: float = 0.0


class KnowledgeBaseRAG:
    """RAG система для базы знаний школы"""
    
    def __init__(self):
        self.knowledge_chunks = []
        self.document_templates = []
        self.regulations = []
        self.load_existing_data()
        
        # Предопределенные шаблоны документов
        self._initialize_templates()
    
    def _initialize_templates(self):
        """Инициализация предопределенных шаблонов"""
        templates = [
            DocumentTemplate(
                id="admin_order_76",
                name="Приказ №76 - Об административном порядке",
                category="administrative",
                description="Основной приказ для административных распоряжений",
                template_fields=[
                    {"name": "order_number", "type": "text", "label": "Номер приказа", "required": True},
                    {"name": "date", "type": "date", "label": "Дата приказа", "required": True},
                    {"name": "title", "type": "text", "label": "Заголовок", "required": True},
                    {"name": "content", "type": "textarea", "label": "Содержание", "required": True},
                    {"name": "responsible", "type": "select", "label": "Ответственный", "options": "staff", "required": True},
                    {"name": "deadline", "type": "date", "label": "Срок исполнения", "required": True}
                ],
                required_roles=["директор", "заместитель директора по УВР"],
                approval_required=True,
                estimated_time="15 минут",
                tags=["администрация", "приказ", "распоряжение"]
            ),
            DocumentTemplate(
                id="hr_order_110",
                name="Приказ №110 - О кадровых вопросах",
                category="hr",
                description="Приказы по кадровым вопросам и персоналу",
                template_fields=[
                    {"name": "order_number", "type": "text", "label": "Номер приказа", "required": True},
                    {"name": "date", "type": "date", "label": "Дата приказа", "required": True},
                    {"name": "employee_name", "type": "select", "label": "Сотрудник", "options": "staff", "required": True},
                    {"name": "action", "type": "select", "label": "Действие", "options": ["назначение", "увольнение", "перевод", "отпуск"], "required": True},
                    {"name": "reason", "type": "textarea", "label": "Основание", "required": True},
                    {"name": "effective_date", "type": "date", "label": "Дата вступления в силу", "required": True}
                ],
                required_roles=["директор", "заместитель директора по УВР", "бухгалтер"],
                approval_required=True,
                estimated_time="20 минут",
                tags=["кадры", "приказ", "увольнение", "назначение"]
            ),
            DocumentTemplate(
                id="educational_plan_130",
                name="План №130 - Учебный план",
                category="educational",
                description="Годовой учебный план и образовательная программа",
                template_fields=[
                    {"name": "plan_number", "type": "text", "label": "Номер плана", "required": True},
                    {"name": "academic_year", "type": "text", "label": "Учебный год", "required": True},
                    {"name": "class_level", "type": "select", "label": "Класс", "options": ["7", "8", "9", "10", "11"], "required": True},
                    {"name": "subjects", "type": "multiselect", "label": "Предметы", "options": "subjects", "required": True},
                    {"name": "goals", "type": "textarea", "label": "Цели и задачи", "required": True},
                    {"name": "methods", "type": "textarea", "label": "Методы и формы работы", "required": True},
                    {"name": "assessment", "type": "textarea", "label": "Система оценки", "required": True}
                ],
                required_roles=["заместитель директора по УВР", "учителя-предметники"],
                approval_required=True,
                estimated_time="45 минут",
                tags=["образование", "план", "учебный процесс"]
            ),
            DocumentTemplate(
                id="incident_report",
                name="Акт об инциденте",
                category="administrative",
                description="Форма для фиксации инцидентов в школе",
                template_fields=[
                    {"name": "incident_number", "type": "text", "label": "Номер инцидента", "required": True},
                    {"name": "date_time", "type": "datetime", "label": "Дата и время", "required": True},
                    {"name": "incident_type", "type": "select", "label": "Тип инцидента", "options": ["medical", "facilities", "behavior", "safety", "academic"], "required": True},
                    {"name": "location", "type": "text", "label": "Место происшествия", "required": True},
                    {"name": "description", "type": "textarea", "label": "Описание", "required": True},
                    {"name": "involved_parties", "type": "text", "label": "Участники", "required": False},
                    {"name": "witnesses", "type": "text", "label": "Свидетели", "required": False},
                    {"name": "immediate_actions", "type": "textarea", "label": "Немедленные действия", "required": True},
                    {"name": "responsible_staff", "type": "select", "label": "Ответственные сотрудники", "options": "staff", "required": True},
                    {"name": "resolution", "type": "textarea", "label": "Решение", "required": False},
                    {"name": "prevention_measures", "type": "textarea", "label": "Профилактические мероприятия", "required": False}
                ],
                required_roles=["директор", "заместители директора", "педагог-психолог"],
                approval_required=False,
                estimated_time="30 минут",
                tags=["инцидент", "безопасность", "фиксация"]
            ),
            DocumentTemplate(
                id="parent_meeting",
                name="Протокол родительского собрания",
                category="educational",
                description="Протокол собрания с родителями",
                template_fields=[
                    {"name": "meeting_number", "type": "text", "label": "Номер собрания", "required": True},
                    {"name": "date", "type": "datetime", "label": "Дата и время", "required": True},
                    {"name": "class_group", "type": "select", "label": "Класс", "options": "classes", "required": True},
                    {"name": "attendees_count", "type": "number", "label": "Количество присутствующих", "required": True},
                    {"name": "agenda", "type": "textarea", "label": "Повестка дня", "required": True},
                    {"name": "discussion_points", "type": "textarea", "label": "Обсужденные вопросы", "required": True},
                    {"name": "decisions", "type": "textarea", "label": "Принятые решения", "required": True},
                    {"name": "next_steps", "type": "textarea", "label": "Следующие шаги", "required": True},
                    {"name": "class_teacher_signature", "type": "signature", "label": "Подпись классного руководителя", "required": True},
                    {"name": "parent_representative_signature", "type": "signature", "label": "Подпись представителя родителей", "required": True}
                ],
                required_roles=["заместитель директора по ВР", "классные руководители"],
                approval_required=False,
                estimated_time="60 минут",
                tags=["родители", "собрание", "протокол", "образование"]
            )
        ]
        
        self.document_templates.extend(templates)
    
    def load_existing_data(self):
        """Загрузка существующих данных"""
        # Загрузка существующих документов
        existing_chunks = load_json("knowledge_chunks.json", [])
        for chunk_data in existing_chunks:
            chunk = KnowledgeChunk(
                id=chunk_data.get('id', ''),
                document_id=chunk_data.get('document_id', ''),
                chunk_type=chunk_data.get('chunk_type', 'regulation'),
                title=chunk_data.get('title', ''),
                content=chunk_data.get('content', ''),
                metadata=chunk_data.get('metadata', {}),
                created_at=datetime.fromisoformat(chunk_data.get('created_at', '')) if chunk_data.get('created_at') else datetime.now(),
                access_count=chunk_data.get('access_count', 0),
                last_accessed=datetime.fromisoformat(chunk_data.get('last_accessed', '')) if chunk_data.get('last_accessed') else None
            )
            self.knowledge_chunks.append(chunk)
        
        # Загрузка регламентов
        self.regulations = load_json("regulations.json", [])
    
    def add_document(self, doc_data: Dict[str, Any]) -> Dict[str, Any]:
        """Добавление нового документа в базу знаний"""
        try:
            # Создание чанков
            chunks = self._create_chunks(doc_data)
            
            # Сохранение чанков
            for chunk in chunks:
                self.knowledge_chunks.append(chunk)
            
            self._save_chunks()
            
            # Логирование
            append_audit_log(
                "document_added",
                "knowledge_base",
                f"Добавлен документ: {doc_data.get('title', '')}",
                {
                    'document_id': doc_data.get('id', ''),
                    'chunks_created': len(chunks),
                    'document_type': doc_data.get('type', '')
                },
                created_at=now_str()
            )
            
            return {
                'success': True,
                'document_id': doc_data.get('id', ''),
                'chunks_created': len(chunks),
                'message': 'Документ успешно добавлен в базу знаний'
            }
        except Exception as error:
            return {
                'success': False,
                'error': str(error),
                'message': 'Ошибка добавления документа'
            }
    
    def _create_chunks(self, doc_data: Dict[str, Any]) -> List[KnowledgeChunk]:
        """Создание чанков из документа"""
        content = doc_data.get('content', '')
        title = doc_data.get('title', '')
        doc_id = doc_data.get('id', '')
        doc_type = doc_data.get('type', 'regulation')
        metadata = doc_data.get('metadata', {})
        
        # Разделение на чанки по параграфам
        paragraphs = content.split('\n\n')
        chunks = []
        
        for i, paragraph in enumerate(paragraphs):
            if paragraph.strip():
                chunk_id = f"{doc_id}_chunk_{i}"
                chunk_title = f"{title} - Часть {i+1}"
                
                chunk = KnowledgeChunk(
                    id=chunk_id,
                    document_id=doc_id,
                    chunk_type=doc_type,
                    title=chunk_title,
                    content=paragraph.strip(),
                    metadata={
                        'paragraph_index': i,
                        'total_paragraphs': len(paragraphs),
                        'document_title': title,
                        'document_type': doc_type,
                        **metadata
                    },
                    created_at=datetime.now()
                )
                chunks.append(chunk)
        
        return chunks
    
    def search_knowledge(self, query: KnowledgeQuery) -> KnowledgeResponse:
        """Поиск в базе знаний с RAG"""
        start_time = datetime.now()
        
        try:
            # Нормализация запроса
            normalized_query = query.query.lower().strip()
            
            # Поиск релевантных чанков
            relevant_chunks = self._find_relevant_chunks(normalized_query, query)
            
            # Генерация ответа
            generated_content = None
            if query.query_type == 'draft':
                generated_content = self._generate_document_draft(query, relevant_chunks)
            elif query.query_type == 'explain':
                generated_content = self._explain_concept(query, relevant_chunks)
            elif query.query_type == 'summarize':
                generated_content = self._summarize_documents(query, relevant_chunks)
            
            # Расчет времени обработки
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # Расчет уверенности
            confidence = self._calculate_confidence(relevant_chunks, normalized_query)
            
            # Обновление статистики доступа
            self._update_access_stats([chunk['id'] for chunk in relevant_chunks])
            
            response = KnowledgeResponse(
                query=query.query,
                relevant_chunks=[
                    {
                        'id': chunk.id,
                        'title': chunk.title,
                        'content': chunk.content[:500] + '...' if len(chunk.content) > 500 else chunk.content,
                        'metadata': chunk.metadata,
                        'relevance_score': self._calculate_relevance(chunk, normalized_query)
                    }
                    for chunk in relevant_chunks
                ],
                generated_content=generated_content,
                suggestions=self._generate_suggestions(query, relevant_chunks),
                confidence=confidence,
                sources=[chunk.document_id for chunk in relevant_chunks],
                processing_time=processing_time
            )
            
            # Логирование запроса
            append_audit_log(
                "knowledge_query",
                "knowledge_base",
                f"Запрос к базе знаний: {query.query}",
                {
                    'query_type': query.query_type,
                    'results_count': len(relevant_chunks),
                    'confidence': confidence,
                    'processing_time': processing_time
                },
                created_at=now_str()
            )
            
            return response
            
        except Exception as error:
            return KnowledgeResponse(
                query=query.query,
                relevant_chunks=[],
                generated_content=f"Ошибка поиска: {str(error)}",
                suggestions=[],
                confidence=0.0,
                sources=[],
                processing_time=(datetime.now() - start_time).total_seconds()
            )
    
    def _find_relevant_chunks(self, query: str, original_query: KnowledgeQuery) -> List[Dict[str, Any]]:
        """Поиск релевантных чанков"""
        relevant_chunks = []
        
        for chunk in self.knowledge_chunks:
            relevance_score = self._calculate_relevance(chunk, query)
            
            if relevance_score > 0.3:  # Порог релевантности
                relevant_chunks.append(chunk)
        
        # Сортировка по релевантности
        relevant_chunks.sort(key=lambda x: self._calculate_relevance(x, query), reverse=True)
        
        # Ограничение количества результатов
        max_results = min(original_query.max_results, len(relevant_chunks))
        
        return relevant_chunks[:max_results]
    
    def _calculate_relevance(self, chunk: KnowledgeChunk, query: str) -> float:
        """Расчет релевантности чанка"""
        content_lower = chunk.content.lower()
        query_words = query.split()
        
        relevance_score = 0.0
        
        # Точное совпадение заголовка
        if chunk.title.lower() == query:
            relevance_score += 2.0
        
        # Совпадение слов в содержимом
        for word in query_words:
            if len(word) > 2:  # Только слова длиннее 2 символов
                word_count = content_lower.count(word)
                if word_count > 0:
                    relevance_score += min(word_count * 0.1, 1.0)
        
        # Учет типа документа
        if chunk.chunk_type in original_query.filters.get('types', []):
            relevance_score += 0.5
        
        # Учет последнего доступа
        if chunk.last_accessed:
            days_since_access = (datetime.now() - chunk.last_accessed).days
            if days_since_access < 7:  # Недавно использованные документы
                relevance_score += 0.3
        
        return min(relevance_score, 3.0)
    
    def _generate_document_draft(self, query: KnowledgeQuery, relevant_chunks: List[Dict[str, Any]]) -> str:
        """Генерация черновика документа"""
        if not relevant_chunks:
            return "Не найдено релевантных документов для создания черновика"
        
        # Определение типа документа
        doc_type = query.filters.get('document_type', 'administrative')
        
        if doc_type == 'admin_order_76':
            return self._generate_admin_order_draft(query, relevant_chunks)
        elif doc_type == 'incident_report':
            return self._generate_incident_report_draft(query, relevant_chunks)
        elif doc_type == 'parent_meeting':
            return self._generate_parent_meeting_draft(query, relevant_chunks)
        else:
            return "Создаю общий черновик документа на основе найденной информации..."
    
    def _generate_admin_order_draft(self, query: KnowledgeQuery, relevant_chunks: List[Dict[str, Any]]) -> str:
        """Генерация черновика приказа"""
        current_date = datetime.now().strftime("%d.%m.%Y")
        
        draft = f"""ПРИКАЗ №76
        
Дата: {current_date}
        
ОБ АДМИНИСТРАТИВНОМ ПОРЯДКЕ В ШКОЛЕ "AQBOBEK"

На основании существующих регламентов и текущей ситуации, приказываю:

1. {query.context or 'Установить порядок...'}

2. Назначить ответственным: [Имя ответственного]

3. Срок исполнения: {query.filters.get('deadline', 'в течение 3 дней')}

4. Контроль исполнения возложить на: [Должность ответственного за контроль]

Директор школы
_________ [ФИО директора]

Примечание: {query.filters.get('notes', '')}
"""
        
        return draft
    
    def _generate_incident_report_draft(self, query: KnowledgeQuery, relevant_chunks: List[Dict[str, Any]]) -> str:
        """Генерация черновика акта об инциденте"""
        current_date = datetime.now().strftime("%d.%m.%Y")
        current_time = datetime.now().strftime("%H:%M")
        
        draft = f"""АКТ ОБ ИНЦИДЕНТЕ №[Номер]

г. {current_date}
{current_time}

1. Место происшествия: {query.filters.get('location', 'Не указано')}
2. Тип инцидента: {query.filters.get('incident_type', 'Не определен')}
3. Описание: {query.context or 'Подробности инцидента'}
4. Участники: {query.filters.get('involved', 'Не указаны')}
5. Принятые меры: {query.filters.get('actions', 'Не указаны')}

Ответственные лица: _______________

Подпись: _______________

Примечания: {query.filters.get('notes', '')}
"""
        
        return draft
    
    def _generate_parent_meeting_draft(self, query: KnowledgeQuery, relevant_chunks: List[Dict[str, Any]]) -> str:
        """Генерация черновика протокола родительского собрания"""
        current_date = datetime.now().strftime("%d.%m.%Y")
        current_time = datetime.now().strftime("%H:%M")
        
        draft = f"""ПРОТОКОЛ РОДИТЕЛЬСКОГО СОБРАНИЯ №[Номер]

г. {current_date}
{current_time}

Место проведения: {query.filters.get('location', 'Актовый зал школы')}
Класс: {query.filters.get('class', 'Не указан')}

Присутствовали: {query.filters.get('attendees_count', 0)} человек

ПОВЕСТКА ДНЯ:
{query.context or 'Вопросы для обсуждения'}

ОБСУЖДЕННЫЕ ВОПРОСЫ:
{query.filters.get('discussion_points', 'Нет вопросов')}

ПРИНЯТЫЕ РЕШЕНИЯ:
1. {query.filters.get('decisions', 'Решения будут добавлены')}
2. {query.filters.get('decisions', 'Решения будут добавлены')}

СЛЕДУЮЩИЕ ШАГИ:
1. {query.filters.get('next_steps', 'Шаги будут определены')}

Подписи:
Классный руководитель: _______________
Председатель родительского комитета: _______________

Примечания: {query.filters.get('notes', '')}
"""
        
        return draft
    
    def _explain_concept(self, query: KnowledgeQuery, relevant_chunks: List[Dict[str, Any]]) -> str:
        """Объяснение концепции на основе базы знаний"""
        concept = query.context or query.query
        
        # Поиск определений и объяснений
        definitions = []
        explanations = []
        
        for chunk in relevant_chunks:
            if 'определение' in chunk.title.lower() or 'определение' in chunk.content.lower():
                definitions.append(chunk.content[:200])
            elif 'объяснение' in chunk.title.lower() or 'объяснение' in chunk.content.lower():
                explanations.append(chunk.content[:300])
        
        explanation = f"""Пояснение по запросу: "{concept}"

ОСНОВНЫЕ ОПРЕДЕЛЕНИЯ:
{chr(10).join(definitions[:3])}

ПОЯСНЕНИЕ:
На основе базы знаний школы Aqbobek, {concept} - это:

{chr(10).join(explanations[:2])}

ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ:
Для получения более подробной информации обратитесь к соответствующим разделам школьных регламентов.
"""
        
        return explanation
    
    def _summarize_documents(self, query: KnowledgeQuery, relevant_chunks: List[Dict[str, Any]]) -> str:
        """Суммаризация документов"""
        if not relevant_chunks:
            return "Не найдено документов для суммаризации"
        
        doc_types = list(set(chunk.get('metadata', {}).get('document_type', '') for chunk in relevant_chunks))
        
        summary = f"""СУММАРНЫЙ ОТЧЕТ

Запрос: {query.query}

НАЙДЕННЫЕ ДОКУМЕНТЫ:
Количество: {len(relevant_chunks)}
Типы: {', '.join(doc_types)}

ОСНОВНОЕ СОДЕРЖАНИЕ:
{chr(10).join([chunk['content'][:300] for chunk in relevant_chunks[:3]])}

КЛЮЧЕВЫЕ АСПЕКТЫ:
1. {self._extract_key_aspects(relevant_chunks, 'требования')}
2. {self._extract_key_aspects(relevant_chunks, 'сроки')}
3. {self._extract_key_aspects(relevant_chunks, 'ответственные')}

РЕКОМЕНДАЦИИ:
{self._generate_recommendations(relevant_chunks, query.query)}

Дата формирования: {datetime.now().strftime("%d.%m.%Y %H:%M")}
"""
        
        return summary
    
    def _extract_key_aspects(self, chunks: List[Dict[str, Any]], aspect_type: str) -> str:
        """Извлечение ключевых аспектов из документов"""
        aspects = []
        
        for chunk in chunks:
            content_lower = chunk.content.lower()
            if aspect_type == 'требования' and any(word in content_lower for word in ['требует', 'необходимо', 'обязательно']):
                aspects.append(chunk.content[:100])
            elif aspect_type == 'сроки' and any(word in content_lower for word in ['срок', 'до', 'крайний']):
                aspects.append(chunk.content[:100])
            elif aspect_type == 'ответственные' and any(word in content_lower for word in ['ответственный', 'назначен', 'обязан']):
                aspects.append(chunk.content[:100])
        
        return '\n'.join(aspects[:3])
    
    def _generate_recommendations(self, chunks: List[Dict[str, Any]], query: str) -> str:
        """Генерация рекомендаций"""
        recommendations = []
        
        # Анализ запроса для определения типа рекомендаций
        if 'отчет' in query.lower():
            recommendations.append("Создать структурированный отчет с разделами: введение, основная часть, выводы")
        if 'инцидент' in query.lower():
            recommendations.append("Разработать профилактические мероприятия для предотвращения подобных ситуаций")
        if 'план' in query.lower():
            recommendations.append("Согласовать план с методистами и классными руководителями")
        
        return '\n'.join(recommendations[:3])
    
    def _generate_suggestions(self, query: KnowledgeQuery, relevant_chunks: List[Dict[str, Any]]) -> List[str]:
        """Генерация предложений по запросу"""
        suggestions = []
        
        # Предложения на основе найденных документов
        if relevant_chunks:
            doc_types = list(set(chunk.get('metadata', {}).get('document_type', '') for chunk in relevant_chunks))
            
            if 'admin_order' in doc_types:
                suggestions.append("Создать приказ на основе шаблона №76")
            if 'incident_report' in doc_types:
                suggestions.append("Заполнить акт об инциденте по установленной форме")
            if 'parent_meeting' in doc_types:
                suggestions.append("Подготовить протокол родительского собрания")
        
        # Предложения на основе типа запроса
        if query.query_type == 'draft':
            suggestions.extend([
                "Уточнить тип документа",
                "Добавить контекст и детали",
                "Выбрать соответствующий шаблон"
            ])
        elif query.query_type == 'search':
            suggestions.extend([
                "Использовать более конкретные ключевые слова",
                "Добавить фильтры по типу документа",
                "Указать временной период"
            ])
        
        return suggestions[:5]
    
    def _calculate_confidence(self, relevant_chunks: List[Dict[str, Any]], query: str) -> float:
        """Расчет уверенности в результате"""
        if not relevant_chunks:
            return 0.0
        
        # Базовая уверенность на основе количества релевантных чанков
        base_confidence = min(len(relevant_chunks) * 0.2, 0.8)
        
        # Повышение уверенности при точных совпадениях
        exact_matches = sum(1 for chunk in relevant_chunks if chunk.title.lower() == query.lower())
        if exact_matches > 0:
            base_confidence += 0.2
        
        return min(base_confidence, 1.0)
    
    def _update_access_stats(self, chunk_ids: List[str]):
        """Обновление статистики доступа"""
        for chunk_id in chunk_ids:
            for chunk in self.knowledge_chunks:
                if chunk.id == chunk_id:
                    chunk.access_count += 1
                    chunk.last_accessed = datetime.now()
                    break
    
    def _save_chunks(self):
        """Сохранение чанков"""
        chunks_data = []
        for chunk in self.knowledge_chunks:
            chunks_data.append({
                'id': chunk.id,
                'document_id': chunk.document_id,
                'chunk_type': chunk.chunk_type,
                'title': chunk.title,
                'content': chunk.content,
                'metadata': chunk.metadata,
                'embedding': chunk.embedding,
                'created_at': chunk.created_at.isoformat(),
                'access_count': chunk.access_count,
                'last_accessed': chunk.last_accessed.isoformat() if chunk.last_accessed else None
            })
        
        save_json("knowledge_chunks.json", chunks_data)
    
    def get_document_templates(self) -> List[DocumentTemplate]:
        """Получение списка шаблонов документов"""
        return self.document_templates
    
    def get_knowledge_statistics(self) -> Dict[str, Any]:
        """Получение статистики базы знаний"""
        total_chunks = len(self.knowledge_chunks)
        total_documents = len(set(chunk.document_id for chunk in self.knowledge_chunks))
        
        # Статистика по типам
        chunk_types = {}
        for chunk in self.knowledge_chunks:
            chunk_type = chunk.chunk_type
            chunk_types[chunk_type] = chunk_types.get(chunk_type, 0) + 1
        
        # Самые используемые документы
        access_counts = [(chunk.id, chunk.access_count) for chunk in self.knowledge_chunks]
        most_accessed = sorted(access_counts, key=lambda x: x[1], reverse=True)[:5]
        
        return {
            'total_chunks': total_chunks,
            'total_documents': total_documents,
            'chunk_types': chunk_types,
            'most_accessed_chunks': [
                {
                    'id': chunk_id,
                    'title': next((chunk.title for chunk in self.knowledge_chunks if chunk.id == chunk_id), ''),
                    'access_count': count
                }
                for chunk_id, count in most_accessed
            ],
            'total_templates': len(self.document_templates),
            'template_categories': list(set(template.category for template in self.document_templates))
        }


# Глобальный экземпляр RAG системы
knowledge_base_rag = KnowledgeBaseRAG()
