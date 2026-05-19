import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Dev-only endpoint POST /api/realism — sends the current render through
 * ChatGPT using the *main Codex token* (`codex exec -i <png>`, the same auth
 * already on this machine, no API key needed) and returns concrete realism
 * corrections the app applies live. Never ships to prod (dev middleware only).
 */
function realismPlugin(): Plugin {
  return {
    name: "coverwatch-realism",
    configureServer(server) {
      server.middlewares.use("/api/realism", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end("POST only");
        }
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          let dataUrl = "";
          try {
            dataUrl = JSON.parse(body).image as string;
          } catch {
            res.statusCode = 400;
            return res.end("bad body");
          }
          const b64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
          const dir = mkdtempSync(join(tmpdir(), "cw-realism-"));
          const png = join(dir, "render.png");
          writeFileSync(png, Buffer.from(b64, "base64"));

          const prompt = `You are a product-photography realism critic. The attached PNG is a render from "Coverwatch", a tool that stages book/magazine covers in retail scenes (bookshop bargain table / gas-station magazine gondola). Judge it as if deciding whether it could pass as a real photograph.

Reply with EXACTLY ONE LINE and nothing else:
REALISM_JSON={"exposure":<number 0.7-1.9, absolute ACES tone-mapping exposure to set>,"glam":<0-1 post/bloom amount>,"finishHint":"matte|gloss|softtouch|spotuv","critique":"<<=220 chars, German, what reads as fake>","fixes":["<=4 short German concrete fixes"]}`;

          const child = spawn(
            "codex",
            [
              "exec",
              "--skip-git-repo-check",
              "--dangerously-bypass-approvals-and-sandbox",
              "-C",
              process.cwd(),
              "-i",
              png,
              "-",
            ],
            { stdio: ["pipe", "pipe", "pipe"] },
          );
          let out = "";
          child.stdout.on("data", (d) => (out += d));
          child.stderr.on("data", (d) => (out += d));
          child.stdin.write(prompt);
          child.stdin.end();

          const killer = setTimeout(() => child.kill("SIGKILL"), 280_000);
          child.on("close", () => {
            clearTimeout(killer);
            res.setHeader("Content-Type", "application/json");
            try {
              writeFileSync(join(dir, "codex-out.txt"), out);
            } catch {
              /* debug only */
            }

            // Pull the first balanced {...} after the marker (or anywhere),
            // tolerating code fences, smart quotes and trailing prose.
            const norm = out.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

            // Codex echoes our prompt (which contains the JSON *template*),
            // then emits its real answer. Collect every balanced {...} that
            // follows a marker and keep the LAST one that actually parses —
            // the placeholder template (`<number …>`) never parses, so it is
            // rejected automatically.
            const balancedAt = (from: number) => {
              const s = norm.indexOf("{", from);
              if (s < 0) return null;
              let depth = 0,
                inStr = false,
                esc = false;
              for (let i = s; i < norm.length; i++) {
                const ch = norm[i];
                if (inStr) {
                  if (esc) esc = false;
                  else if (ch === "\\") esc = true;
                  else if (ch === '"') inStr = false;
                } else if (ch === '"') inStr = true;
                else if (ch === "{") depth++;
                else if (ch === "}" && --depth === 0)
                  return norm.slice(s, i + 1);
              }
              return null;
            };

            let parsed: Record<string, unknown> | null = null;
            const re = /REALISM_JSON\s*=/g;
            let m: RegExpExecArray | null;
            const tries: number[] = [];
            while ((m = re.exec(norm))) tries.push(m.index + m[0].length);
            if (tries.length === 0) tries.push(0); // fall back to any JSON
            for (const idx of tries) {
              const cand = balancedAt(idx);
              if (!cand) continue;
              try {
                const p = JSON.parse(cand.replace(/,\s*([}\]])/g, "$1"));
                if (p && typeof p === "object" && "exposure" in p) parsed = p;
              } catch {
                /* template / noise — skip */
              }
            }
            if (!parsed) {
              res.statusCode = 502;
              console.error("[realism] no parseable verdict. tail:\n", out.slice(-1200));
              return res.end(JSON.stringify({ error: "no verdict from codex" }));
            }
            res.end(JSON.stringify(parsed));
          });
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), realismPlugin()],
  server: { host: true },
  publicDir: "assets",
});
