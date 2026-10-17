import os
import tempfile
import unittest

import auth


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_db_path = auth.DB_PATH
        auth.DB_PATH = os.path.join(self.temp_dir.name, "users.db")
        auth._init_db()

    def tearDown(self):
        auth.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_register_and_login_with_username_or_email(self):
        result = auth.register(
            auth.RegisterRequest(
                username="ecg-user",
                email="ecg-user@example.com",
                password="correct-password",
            )
        )
        self.assertTrue(result["success"])

        for identifier in ("ecg-user", "ecg-user@example.com"):
            with self.subTest(identifier=identifier):
                login = auth.login(
                    auth.LoginRequest(
                        identifier=identifier,
                        password="correct-password",
                    )
                )
                self.assertEqual(login["user"]["username"], "ecg-user")

    def test_password_change_requires_current_password(self):
        auth.register(
            auth.RegisterRequest(
                username="ecg-user",
                email="ecg-user@example.com",
                password="correct-password",
            )
        )

        with self.assertRaises(auth.HTTPException) as error:
            auth.reset_password(
                auth.ResetPasswordRequest(
                    identifier="ecg-user",
                    current_password="incorrect-password",
                    new_password="new-password",
                )
            )
        self.assertEqual(error.exception.status_code, 401)

        auth.reset_password(
            auth.ResetPasswordRequest(
                identifier="ecg-user@example.com",
                current_password="correct-password",
                new_password="new-password",
            )
        )
        self.assertTrue(
            auth.login(
                auth.LoginRequest(
                    identifier="ecg-user",
                    password="new-password",
                )
            )["success"]
        )


if __name__ == "__main__":
    unittest.main()
