"""One error type for every refused request. Rendered as problem+json with no-store (see main.py)."""


class ProblemError(Exception):
    def __init__(self, status: int, title: str, detail: str | None = None) -> None:
        super().__init__(title)
        self.status = status
        self.title = title
        self.detail = detail
