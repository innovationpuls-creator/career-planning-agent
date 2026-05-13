from __future__ import annotations

import pytest
from app.services.tool_registry import ToolRegistry, ToolRegistryError


class TestToolRegistry:
    def test_register_and_execute(self):
        registry = ToolRegistry()
        registry.register(
            name="test_tool",
            description="A test tool",
            parameters={"type": "object", "properties": {}},
            handler=lambda args: {"result": "done"},
        )
        result = registry.execute("test_tool", {})
        assert result == {"result": "done"}

    def test_get_schema_returns_list(self):
        registry = ToolRegistry()
        registry.register(
            name="tool_a",
            description="Tool A",
            parameters={"type": "object", "properties": {"x": {"type": "string"}}},
            handler=lambda args: {},
        )
        schemas = registry.get_schema()
        assert len(schemas) == 1
        assert schemas[0]["type"] == "function"
        assert schemas[0]["function"]["name"] == "tool_a"

    def test_duplicate_register_raises(self):
        registry = ToolRegistry()
        registry.register("dup", "desc", {"type": "object", "properties": {}}, lambda args: {})
        with pytest.raises(ToolRegistryError, match="already registered"):
            registry.register("dup", "desc", {"type": "object", "properties": {}}, lambda args: {})

    def test_execute_unknown_tool_raises(self):
        registry = ToolRegistry()
        with pytest.raises(ToolRegistryError, match="not found"):
            registry.execute("nonexistent", {})

    def test_empty_registry_returns_empty_schema(self):
        registry = ToolRegistry()
        assert registry.get_schema() == []
