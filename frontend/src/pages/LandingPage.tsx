import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { MCPLandingSection } from "@/components/landing-page/MCP";

export default function LandingPage() {
  return (
    <>
      <section className="space-y-10 pb-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <p className="soft-badge">ImgZenix</p>
          <h1 className="mt-5 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            A structured image workspace, designed for scale and control.
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
            From nested folders to AI-driven workflows via MCP - everything just
            works.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">Get Started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href="https://github.com/cleosneha"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-6xl">
          <motion.div
            className="feature-surface overflow-hidden p-0"
            initial={{ opacity: 0, y: 64 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <img
              src="/landing-page/hero-section.png"
              alt="ImgZenix dashboard preview"
              className="h-auto w-full object-cover"
            />
          </motion.div>
        </div>
      </section>
      <MCPLandingSection />
    </>
  );
}
