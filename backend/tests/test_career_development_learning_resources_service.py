from app.services.career_development_learning_resources import (
    parse_learning_resource_recommendations,
)


def test_parse_learning_resource_recommendations_supports_nested_chinese_keys():
    answer = """
    {
      "data": {
        "推荐结果": [
          {
            "标题": "MDN Web Docs",
            "推荐网址": "https://developer.mozilla.org/",
            "推荐理由": "适合补前端文档规范与基础知识。"
          }
        ]
      }
    }
    """

    resources = parse_learning_resource_recommendations(
        answer,
        fallback_title="文档规范意识",
    )

    assert len(resources) == 1
    assert resources[0].title == "MDN Web Docs"
    assert resources[0].url == "https://developer.mozilla.org/"
    assert resources[0].reason == "适合补前端文档规范与基础知识。"
