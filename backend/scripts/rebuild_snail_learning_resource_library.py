from app.db.session import SessionLocal
from app.services.snail_learning_resource_library import rebuild_learning_resource_library


def main() -> None:
    with SessionLocal() as db:
        total = rebuild_learning_resource_library(db)
    print(f"Rebuilt snail learning resource library with {total} rows.")


if __name__ == "__main__":
    main()
