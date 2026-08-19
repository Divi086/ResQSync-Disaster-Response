def calculate_priority(severity, people_affected, request_type):

    score = 0

    # Severity contribution
    score += severity * 10

    # People affected contribution
    if people_affected >= 50:
        score += 30
    elif people_affected >= 20:
        score += 20
    elif people_affected >= 10:
        score += 10
    else:
        score += 5

    # Emergency type contribution
    if request_type == "MEDICAL":
        score += 25
    elif request_type == "RESCUE":
        score += 25
    elif request_type == "MEDICINE":
        score += 20
    elif request_type == "WATER":
        score += 15
    elif request_type == "FOOD":
        score += 10
    elif request_type == "SHELTER":
        score += 10
    else:
        score += 5

    # Convert score into priority level
    if score >= 80:
        priority = "CRITICAL"
    elif score >= 60:
        priority = "HIGH"
    elif score >= 40:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    return score, priority