from fastapi import APIRouter, Response

from app import config
from app.api.data import router as data_router
from app.bundle import Bundle, BundleError, get_bundle
from app.schemas import Dataset, Health, MachineInfo, Metadata, PlannerDefaults, ReplayWindow

router = APIRouter()
router.include_router(data_router)


def _bundle_or_none() -> Bundle | None:
    try:
        return get_bundle()
    except BundleError:
        return None


@router.get("/health", response_model=Health)
def health(response: Response) -> Health:
    response.headers["Cache-Control"] = config.CACHE_NO_STORE
    bundle = _bundle_or_none()
    return Health(
        status="ok",
        model_version=bundle.model_version if bundle else None,
        model_available=bundle is not None,
    )


@router.get("/metadata", response_model=Metadata)
def metadata(response: Response) -> Metadata:
    response.headers["Cache-Control"] = config.CACHE_METADATA
    bundle = _bundle_or_none()
    dataset = Dataset(
        name=config.DATASET_NAME,
        publisher=config.DATASET_PUBLISHER,
        source=config.DATASET_REPOSITORY,
        pinned_commit=config.DATASET_PINNED_COMMIT,
        simulated=True,
    )
    planner = PlannerDefaults.model_validate(config.PLANNER_DEFAULTS)
    if bundle is None:
        return Metadata(
            app_name=config.APP_NAME,
            version=config.APP_VERSION,
            dataset=dataset,
            planner_defaults=planner,
            model_version=None,
            model_available=False,
            replay_window=ReplayWindow(
                start=config.REPLAY_WINDOW_START, end=config.REPLAY_WINDOW_END, status="planned"
            ),
        )
    meta = bundle.meta
    unseen = {int(m) for m in meta["unseen_machines"]}
    return Metadata(
        app_name=config.APP_NAME,
        version=config.APP_VERSION,
        dataset=dataset,
        planner_defaults=planner,
        model_version=bundle.model_version,
        model_available=True,
        replay_window=ReplayWindow(
            start=bundle.replay_start.isoformat(), end=bundle.replay_end.isoformat(), status="ready"
        ),
        synthetic=bundle.synthetic,
        model_created=str(meta["created"]),
        default_cutoff_percent=bundle.default_cutoff,
        splits={k: [str(x) for x in v] for k, v in meta["splits"].items() if isinstance(v, list)},
        replay_start_branch=str(meta["replay"]["branch"]),
        data_credit=str(meta["data_credit"]),
        machines=[
            MachineInfo(
                machine_id=int(m["machine_id"]),
                model=m["model"],
                age=int(m["age"]),
                unseen=int(m["machine_id"]) in unseen,
            )
            for m in meta["machines"]
        ],
        unseen_machines=sorted(unseen),
    )
