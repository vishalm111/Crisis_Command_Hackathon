from backend.data.seed import build_seed_state
from backend.models.domain import CrisisState

def test_seed_validation():
    state = build_seed_state()
    assert isinstance(state, CrisisState)
    assert len(state.resources) == 6
    assert len(state.facilities) == 3
    
    # Check that every resource has base equal to location
    for resource in state.resources:
        assert resource.base.lat == resource.location.lat
        assert resource.base.lng == resource.location.lng
