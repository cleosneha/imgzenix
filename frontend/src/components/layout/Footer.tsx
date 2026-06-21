import { Link } from "react-router";
import { FaGithub, FaLinkedin, FaTwitter, FaGlobe } from "react-icons/fa";
import { IoMdMail } from "react-icons/io";

const SOCIAL_LINKS = [
  { href: "https://github.com/cleosneha", label: "GitHub", icon: FaGithub },
  { href: "https://twitter.com/cleosneha", label: "X", icon: FaTwitter },
  {
    href: "https://linkedin.com/in/cleosneha",
    label: "LinkedIn",
    icon: FaLinkedin,
  },
  {
    href: "https://snehasharma.me",
    label: "Portfolio",
    icon: FaGlobe,
  },
];

export function Footer() {
  return (
    <footer className="w-full relative overflow-hidden ">
      {/* Decorative Gradient Background */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-44 rounded-t-full blur-3xl"
          style={{
            background: "linear-gradient(to top, var(--primary), transparent)",
            opacity: 0.15,
          }}
        />
      </div>

      <div className="border-t border-border/40">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8 text-muted-foreground">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold group-hover:shadow-lg transition-shadow">
                IZ
              </div>
              <span className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                ImgZenix
              </span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm">
              Organize campaigns with a clean, scalable folder workspace for
              image management and asset organization.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-foreground font-semibold mb-4">Contact</h4>

            <a
              href="mailto:hello@imgzenix.app"
              className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              <IoMdMail className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm">cleosneha@gmail.com</span>
            </a>
          </div>

          {/* Follow Us */}
          <div>
            <h4 className="text-foreground font-semibold mb-4">Follow Us</h4>
            <div className="flex items-center gap-4">
              {SOCIAL_LINKS.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors duration-200"
                  >
                    <Icon className="w-5 h-5" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/20 relative">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between text-muted-foreground text-sm">
          <div>© 2026 ImgZenix. All rights reserved.</div>
        </div>
        {/* Semicircle Gradient at Bottom */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-[-40px] w-[340px] h-[90px] rounded-t-full blur-2xl z-0"
          style={{
            background:
              "radial-gradient(ellipse at center, var(--primary) 60%, var(--background) 100%)",
            opacity: 0.45,
          }}
        />
      </div>
    </footer>
  );
}
