CURRENT_USER_ID = None

def setup_context(user_id: str):
    global CURRENT_USER_ID
    CURRENT_USER_ID = user_id
