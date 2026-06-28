"""Generic type definitions for URL scrapers with selector-based field mapping."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Generic, Literal, Protocol, TypeVar, runtime_checkable

SelectorStrategy = Literal[
    "css",
    "xpath",
    "id",
    "name",
    "class_name",
    "tag_name",
    "link_text",
    "partial_link_text",
]

TransformFn = Callable[[str], Any]


@dataclass(frozen=True)
class SelectorSpec:
    """Maps a single output field to a DOM location."""

    selector: str
    by: SelectorStrategy = "css"
    attribute: str | None = None
    multiple: bool = False
    transform: TransformFn | None = field(default=None, compare=False, hash=False)
    default: Any = None


FieldMapping = dict[str, SelectorSpec]


@runtime_checkable
class ScrapeResult(Protocol):
    """Protocol for scraped record types (typically TypedDict or dataclass)."""


T = TypeVar("T", bound=ScrapeResult)


@dataclass
class ScrapeSchema(Generic[T]):
    """Links an output type to the selectors that populate its fields."""

    fields: FieldMapping
    wait_for: SelectorSpec | None = None
    wait_timeout: int = 10
    page_load_timeout: int = 30
