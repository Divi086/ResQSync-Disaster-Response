from pydantic import BaseModel


class EmergencyRequestCreate(BaseModel):
    user_id: int
    location_id: int
    request_type: str
    description: str
    severity: int
    people_affected: int