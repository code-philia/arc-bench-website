import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.notification import Notification
from app.services.notification_service import NotificationService


class NotificationServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine)
        self.session = sessionmaker(bind=self.engine)()
        self.service = NotificationService(self.session)
        self.session.add_all(
            [
                Notification(id="unread-a", user_id="user-a", kind="completed", title="A", body="A"),
                Notification(id="unread-b", user_id="user-a", kind="failed", title="B", body="B"),
                Notification(id="read-a", user_id="user-a", kind="completed", title="C", body="C", is_read=True),
                Notification(id="other-user", user_id="user-b", kind="completed", title="D", body="D"),
            ]
        )
        self.session.commit()

    def tearDown(self) -> None:
        self.session.close()
        self.engine.dispose()

    def test_mark_all_read_and_delete_only_current_users_notifications(self) -> None:
        self.assertEqual(self.service.mark_all_read("user-a"), 2)
        _, unread_count = self.service.list_for_user("user-a")
        self.assertEqual(unread_count, 0)

        self.service.delete("unread-a", "user-a")
        self.assertIsNone(self.session.get(Notification, "unread-a"))

        self.assertEqual(self.service.delete_all("user-a"), 2)
        items, unread_count = self.service.list_for_user("user-a")
        self.assertEqual(items, [])
        self.assertEqual(unread_count, 0)
        self.assertIsNotNone(self.session.get(Notification, "other-user"))


if __name__ == "__main__":
    unittest.main()
