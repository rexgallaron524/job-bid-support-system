import { z } from "zod";

const webAddress = z.string().trim().max(2000).refine(value => {
  if (!value) return true;
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}, "Use a full HTTP or HTTPS profile link.");
export const profileSchema = z.object({
  fullName: z.string().trim().max(150), headline: z.string().trim().max(300),
  location: z.string().trim().max(250), contactEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
  phone: z.string().trim().max(100), linkedInUrl: webAddress, websiteUrl: webAddress,
  summary: z.string().max(8000), experience: z.string().max(30000), education: z.string().max(12000),
  skills: z.string().max(12000), projects: z.string().max(20000), certifications: z.string().max(8000),
  languages: z.string().max(4000), achievements: z.string().max(8000), volunteering: z.string().max(8000),
  preferences: z.string().max(6000), additionalInfo: z.string().max(10000),
}).strict();
export type CareerProfile = z.infer<typeof profileSchema>;
export type ProfileResponse = { profile: CareerProfile; revision: number; updatedAt: string | null };
export const EMPTY_PROFILE: CareerProfile = {
  fullName: "", headline: "", location: "", contactEmail: "", phone: "", linkedInUrl: "", websiteUrl: "",
  summary: "", experience: "", education: "", skills: "", projects: "", certifications: "", languages: "",
  achievements: "", volunteering: "", preferences: "", additionalInfo: "",
};
export const PROFILE_SECTIONS = [
  { key: "summary", label: "Professional summary", hint: "Your career story, strengths, and the kind of work you do best.", placeholder: "Write or paste your LinkedIn About section…", max: 8000 },
  { key: "experience", label: "Work experience", hint: "Include every relevant role: company, title, location, dates, responsibilities, and measurable achievements.", placeholder: "Company · Role · Location\nStart date – End date (or Present)\n• Achievement, with results or numbers\n• Technologies and responsibilities\n\nAdd your next role…", max: 30000 },
  { key: "education", label: "Education", hint: "Schools, degrees, fields of study, dates, and relevant coursework or honors.", placeholder: "Institution · Degree · Field of study\nDates · Honors and relevant courses…", max: 12000 },
  { key: "skills", label: "Skills", hint: "Technical tools, methods, domain knowledge, and interpersonal skills. Group related skills together.", placeholder: "Languages: …\nFrameworks: …\nTools and platforms: …\nOther strengths: …", max: 12000 },
  { key: "projects", label: "Projects", hint: "Include project names, links, dates, your contribution, technologies, and outcomes.", placeholder: "Project name · URL\nYour role and dates\nProblem, contribution, technologies, and results…", max: 20000 },
  { key: "certifications", label: "Certifications & courses", hint: "Certification, issuer, issue/expiry dates, credential ID, and verification link.", placeholder: "Certification · Issuer\nIssued: … · Expires: …\nCredential ID / URL: …", max: 8000 },
  { key: "languages", label: "Languages", hint: "Language and proficiency, including relevant exam results.", placeholder: "English — Professional proficiency\n…", max: 4000 },
  { key: "achievements", label: "Awards, publications & achievements", hint: "Awards, publications, patents, speaking engagements, and other evidence of your work.", placeholder: "Title · Organization · Date · Link\nDetails and significance…", max: 8000 },
  { key: "volunteering", label: "Volunteering & organizations", hint: "Organization, role, dates, responsibilities, and impact.", placeholder: "Organization · Role · Dates\nContribution and impact…", max: 8000 },
  { key: "preferences", label: "Career preferences", hint: "Target roles, industries, locations, work arrangements, and other preferences for tailoring a resume.", placeholder: "Target roles: …\nPreferred industries / locations: …\nRemote / hybrid / on-site: …", max: 6000 },
  { key: "additionalInfo", label: "Additional career information", hint: "Relevant details that do not fit elsewhere. Keep facts you may want to use in a tailored resume.", placeholder: "Additional accomplishments, professional memberships, portfolio details…", max: 10000 },
] as const;

export function profileText(profile: CareerProfile): string {
  const contact = [profile.location, profile.contactEmail, profile.phone, profile.linkedInUrl, profile.websiteUrl].filter(Boolean).join("\n");
  const parts = ["MASTER CAREER PROFILE", profile.fullName, profile.headline, contact,
    ...PROFILE_SECTIONS.filter(section => profile[section.key].trim()).map(section => section.label.toUpperCase() + "\n" + profile[section.key])];
  return parts.filter(part => part.trim()).join("\n\n").replace(/\r?\n/g, "\r\n") + "\r\n";
}
