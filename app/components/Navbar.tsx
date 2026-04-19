"use client";

import Link from "next/link";
import { useState } from "react";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(10, 10, 15, 0.8)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
      }}
    >
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto",
          padding: "0 24px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ textDecoration: "none" }}>
          <span
            className="gradient-text"
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              letterSpacing: "-0.03em",
            }}
          >
            Automate
          </span>
        </Link>

        {/* Desktop Nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "32px",
          }}
          className="hidden md:flex"
        >
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/courses", label: "Courses" },
            { href: "/profile", label: "Profile" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontSize: "0.9rem",
                fontWeight: 500,
                transition: "color 0.2s ease",
                position: "relative",
                padding: "4px 0",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* CTA + Mobile Toggle */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/login" className="hidden md:block" style={{ textDecoration: "none" }}>
            <button className="btn-primary" style={{ padding: "10px 24px", fontSize: "0.875rem" }}>
              Login
            </button>
          </Link>

          {/* Mobile hamburger */}
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-primary)",
              cursor: "pointer",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "5px",
            }}
            aria-label="Toggle menu"
          >
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "var(--text-primary)",
                borderRadius: "2px",
                transition: "all 0.3s ease",
                transform: mobileOpen ? "rotate(45deg) translateY(7px)" : "none",
              }}
            />
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "var(--text-primary)",
                borderRadius: "2px",
                transition: "all 0.3s ease",
                opacity: mobileOpen ? 0 : 1,
              }}
            />
            <span
              style={{
                display: "block",
                width: "22px",
                height: "2px",
                background: "var(--text-primary)",
                borderRadius: "2px",
                transition: "all 0.3s ease",
                transform: mobileOpen ? "rotate(-45deg) translateY(-7px)" : "none",
              }}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          className="md:hidden animate-fade-in"
          style={{
            padding: "16px 24px 24px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/courses", label: "Courses" },
            { href: "/profile", label: "Profile" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{
                color: "var(--text-secondary)",
                textDecoration: "none",
                fontSize: "1rem",
                fontWeight: 500,
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--surface-glass)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/login"
            onClick={() => setMobileOpen(false)}
            style={{ textDecoration: "none", marginTop: "8px" }}
          >
            <button className="btn-primary" style={{ width: "100%", padding: "12px" }}>
              Login
            </button>
          </Link>
        </div>
      )}
    </nav>
  );
}