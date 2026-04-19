from storage import load_collection, save_collection

def load_json(filename: str, default=None):
    return load_collection(filename, default)

def save_json(filename: str, data):
    save_collection(filename, data)
