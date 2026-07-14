import { Link } from "react-router";

export function meta() {
  return [
    { title: "Page not found — react-qr-lite" },
    { name: "robots", content: "noindex" },
  ];
}

export default function NotFound() {
  return (
    <div className="hero py-24">
      <div className="hero-content text-center">
        <div>
          <h1 className="text-5xl font-bold">404</h1>
          <p className="py-6">
            This page doesn't exist. The QR code you scanned may be fine — the URL just isn't.
          </p>
          <Link to="/" className="btn btn-primary">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
