from app import main as app_main


def test_qdrant_autostart_uses_backend_local_binary() -> None:
    backend_root = app_main._get_backend_root()

    assert backend_root.name == "backend"
    assert (backend_root / "app" / "main.py").is_file()
    assert (backend_root / "qdrant-bin" / "qdrant").is_file()
