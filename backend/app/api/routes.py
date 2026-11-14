from fastapi import APIRouter, Response

from app import config
from app.schemas import Dataset, Health, Metadata, ReplayWindow

router = APIRouter()


@router.get("/health", response_model=Health)
def health(response: Response) -> Health:
    response.headers["Cache-Control"] = config.CACHE_NO_STORE
    return Health(status="ok", model_version=None)


@router.get("/metadata", response_model=Metadata)
def metadata(response: Response) -> Metadata:
    response.headers["Cache-Control"] = config.CACHE_METADATA
    return Metadata(
        app_name=config.APP_NAME,
        version=config.APP_VERSION,
        dataset=Dataset(
            name=config.DATASET_NAME,
            publisher=config.DATASET_PUBLISHER,
            source=config.DATASET_REPOSITORY,
            pinned_commit=config.DATASET_PINNED_COMMIT,
            simulated=True,
        ),
        model_version=None,
        model_available=False,
        replay_window=ReplayWindow(
            start=config.REPLAY_WINDOW_START,
            end=config.REPLAY_WINDOW_END,
            status="planned",
        ),
    )
