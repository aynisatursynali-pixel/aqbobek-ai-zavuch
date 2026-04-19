import json
import tempfile
import unittest
from pathlib import Path

import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import school_ops  # noqa: E402
import storage  # noqa: E402


class StorageTests(unittest.TestCase):
    def test_sqlite_roundtrip_for_tasks(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_path = Path(tmpdir)
            original_data_dir = storage.DATA_DIR
            original_db_path = storage.DB_PATH
            try:
                storage.DATA_DIR = temp_path
                storage.DB_PATH = temp_path / "test.db"
                payload = [{"title": "Demo", "assignee": "Айгерим", "deadline": "Сегодня"}]
                storage.save_collection("tasks.json", payload)
                loaded = storage.load_collection("tasks.json", [])
                self.assertEqual(loaded, payload)
                exported = json.loads((temp_path / "tasks.json").read_text(encoding="utf-8"))
                self.assertEqual(exported, payload)
            finally:
                storage.DATA_DIR = original_data_dir
                storage.DB_PATH = original_db_path


class SchoolOpsTests(unittest.TestCase):
    def test_regulation_search_returns_sources(self):
        result = school_ops.regulation_search("обязательные документы педагогов и формы", selected_code="130", limit=2)
        self.assertTrue(result)
        self.assertEqual(result[0]["code"], "130")
        self.assertIn("source_url", result[0])

    def test_schedule_conflicts_returns_list(self):
        conflicts = school_ops.build_schedule_conflicts(day="Дүйсенбі")
        self.assertIsInstance(conflicts, list)

    def test_apply_ai_analysis_without_persist_counts_tasks(self):
        sample = {
            "summary": "demo",
            "attendance": None,
            "incident": None,
            "tasks": [{"title": "Подготовить зал", "assignee": "Айгерим", "deadline": None, "priority": None}],
            "substitution_request": None,
            "document_request": None,
        }
        result = school_ops.apply_ai_analysis(sample, source="test", persist=False)
        self.assertTrue(result["handled"])
        self.assertEqual(result["created"]["tasks"], 1)


if __name__ == "__main__":
    unittest.main()
