import argparse
import uvicorn


def main():
    parser = argparse.ArgumentParser(description="VoiceLab Backend Server")
    parser.add_argument("--port", type=int, default=18923, help="Port to run the server on")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    args = parser.parse_args()

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()
