"""Tests for the competency profile client factory function."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core.config import settings
from app.services.local_competency_profile import LocalCompetencyProfileClient
from app.services.student_competency_profile import (
    DifyStudentCompetencyClient,
    get_competency_profile_client,
)


class TestGetCompetencyProfileClient:
    """Tests for get_competency_profile_client() factory function."""

    def test_returns_local_client_when_flag_is_true(self):
        with patch.object(settings, "use_local_competency_profile", True):
            client = get_competency_profile_client()
            assert isinstance(client, LocalCompetencyProfileClient)

    def test_returns_dify_client_when_flag_is_false(self):
        with (
            patch.object(settings, "use_local_competency_profile", False),
            patch.object(settings, "dify_api_key", "test-key"),
        ):
            client = get_competency_profile_client()
            assert isinstance(client, DifyStudentCompetencyClient)

    def test_multiple_calls_return_same_local_singleton(self):
        with patch.object(settings, "use_local_competency_profile", True):
            client1 = get_competency_profile_client()
            client2 = get_competency_profile_client()
            assert client1 is client2

    def test_multiple_calls_return_same_dify_singleton(self):
        with (
            patch.object(settings, "use_local_competency_profile", False),
            patch.object(settings, "dify_api_key", "test-key"),
        ):
            client1 = get_competency_profile_client()
            client2 = get_competency_profile_client()
            assert client1 is client2

    def test_local_client_has_expected_methods(self):
        with patch.object(settings, "use_local_competency_profile", True):
            client = get_competency_profile_client()
            assert hasattr(client, "get_runtime_config")
            assert hasattr(client, "send_message")
            assert hasattr(client, "upload_file")
            assert hasattr(client, "aclose")

    def test_dify_client_has_expected_methods(self):
        with (
            patch.object(settings, "use_local_competency_profile", False),
            patch.object(settings, "dify_api_key", "test-key"),
        ):
            client = get_competency_profile_client()
            assert hasattr(client, "get_runtime_config")
            assert hasattr(client, "send_message")
            assert hasattr(client, "upload_file")
