"""
迁移脚本：为所有 workspace 重新生成 growth_plan_phases
（资源库从 6 个岗位扩展为 5 个标准岗位后，现有 workspace 的 stored phases 可能是旧数据）。

逻辑：
1. 读取所有 career_development_plan_workspaces
2. 对每个 workspace，取其关联的 favorite 的 canonical_job_title
3. 如果该 title 在 SUPPORTED_JOB_TITLES 中，调用 initialize_plan_workspace 更新 stored phases
   （initialize_plan_workspace 会重新 attach 新的 learning resources）
4. 如果不在 SUPPORTED_JOB_TITLES 中，打印警告
"""
from app.db.session import SessionLocal
from app.models.career_development_plan_workspace import CareerDevelopmentPlanWorkspace
from app.models.career_development_favorite_report import CareerDevelopmentFavoriteReport
from app.services.snail_learning_resource_library import SUPPORTED_JOB_TITLES
from app.services.career_development_plan_workspace import (
    initialize_plan_workspace,
    _json_dumps,
    _json_loads,
)
from sqlalchemy import select


def main() -> None:
    with SessionLocal() as db:
        # 找出所有 workspace
        rows = db.scalars(
            select(CareerDevelopmentPlanWorkspace).order_by(
                CareerDevelopmentPlanWorkspace.id
            )
        ).all()

        updated = 0
        skipped = 0
        errors = 0

        for row in rows:
            # 读取关联的 favorite
            favorite = db.execute(
                select(CareerDevelopmentFavoriteReport).where(
                    CareerDevelopmentFavoriteReport.id == row.favorite_id
                )
            ).scalar_one_or_none()

            if favorite is None:
                print(f"  [{row.id}] favorite_id={row.favorite_id} 不存在，跳过")
                skipped += 1
                continue

            title = favorite.canonical_job_title
            if title not in SUPPORTED_JOB_TITLES:
                print(f"  [{row.id}] favorite='{title}' 不在 SUPPORTED_JOB_TITLES，跳过")
                skipped += 1
                continue

            # 检查是否已有 failed 状态的 stored phases
            payload = _json_loads(row.current_plan_json) or _json_loads(
                row.generated_plan_json
            )
            has_failed = False
            if payload:
                for phase in payload.get("growth_plan_phases") or []:
                    for module in phase.get("learning_modules") or []:
                        if module.get("resource_status") == "failed":
                            has_failed = True
                            break
                    if has_failed:
                        break

            if not has_failed:
                print(
                    f"  [{row.id}] favorite='{title}' phases 已正常，跳过"
                )
                skipped += 1
                continue

            print(
                f"  [{row.id}] favorite='{title}' phases 有 failed，重新初始化..."
            )
            try:
                new_row = initialize_plan_workspace(
                    db,
                    user_id=row.user_id,
                    favorite_id=row.favorite_id,
                )
                # initialize_plan_workspace 已经 commit，验证
                db.commit()
                updated += 1
                print(
                    f"    → 完成，新 phases[0] resource_status="
                    f"{new_row.generated_plan_json[:200]}..."
                )
            except Exception as e:
                db.rollback()
                errors += 1
                print(f"    → 错误: {e}")

    print()
    print(f"完成：更新 {updated}，跳过 {skipped}，错误 {errors}")


if __name__ == "__main__":
    main()
