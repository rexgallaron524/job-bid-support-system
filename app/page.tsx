import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from "./chatgpt-auth";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  if (!user) return <main className="login-page"><div className="login-orbit" /><a className="brand login-brand" href="/"><span className="brand-mark">j.</span>jobbid<span className="brand-dot">✦</span></a><section className="login-card"><span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span><h1>A little structure.<br /><span>A world of possibility.</span></h1><p>Keep every opportunity, tailored resume, and next step in one private workspace. Make room for what comes next.</p><a className="btn primary login-button" href={chatGPTSignInPath("/")} target="_top">Sign in with ChatGPT <span>↗</span></a><div className="login-trust"><span>◈ Private by design</span><span>◈ Your jobs. Your space.</span></div></section><footer className="login-footer">A calmer way to find your next role.</footer></main>;
  return <Workspace user={{ name: user.displayName, email: user.email }} signOutUrl={chatGPTSignOutPath("/")} />;
}
