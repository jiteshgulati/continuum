export type Role = 'Admin' | 'Reviewer' | 'Employee';
export type Status =
  | 'Draft'
  | 'Needs Verification'
  | 'Verified'
  | 'Needs Clarification'
  | 'Disputed'
  | 'Conflict Detected'
  | 'Outdated'
  | 'Archived'
  | 'Rejected';
export interface Base {
  id: string;
  orgId: string;
  createdAt: string;
}
export interface User extends Base {
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
}
export interface Employee extends Base {
  userId?: string;
  name: string;
  roleTitle: string;
  department: string;
  employmentStatus: 'Active' | 'Departing' | 'Departed';
  knowledgeAreas: string[];
  backupExperts: number;
  criticalAreas: number;
  departureDate?: string;
}
export interface Message {
  id: string;
  sender: 'expert' | 'assistant';
  content: string;
  createdAt: string;
}
export interface Interview extends Base {
  employeeId: string;
  createdBy: string;
  area: string;
  objective: string;
  status: 'Active' | 'Paused' | 'Completed';
  messages: Message[];
  discoveries: string[];
  extractedCardIds: string[];
}
export interface Evidence {
  sourceId: string;
  sourceType: 'interview' | 'document' | 'note';
  excerpt: string;
  label: string;
  supportType: 'Supporting' | 'Conflicting';
}
export interface Version {
  version: number;
  content: Record<string, unknown>;
  actor: string;
  createdAt: string;
  reason: string;
}
export interface Knowledge extends Base {
  title: string;
  summary: string;
  area: string;
  type: string;
  symptoms: string[];
  actions: string[];
  warnings: string[];
  reasoning: string;
  dependencies: string[];
  exceptions: string[];
  tags: string[];
  confidence: number;
  clarificationQuestions: string[];
  status: Status;
  expertId: string;
  evidence: Evidence[];
  version: number;
  versions: Version[];
  lastVerifiedAt?: string;
  verifiedBy?: string;
  reviewComment?: string;
  reviewDueAt?: string;
}
export interface Document extends Base {
  employeeId: string;
  interviewId?: string;
  fileName: string;
  storageKey?: string;
  text: string;
  status: 'Extracted' | 'Analysed' | 'Failed';
  analysis?: string;
  analysisError?: string;
}
export interface Conflict extends Base {
  knowledgeAId: string;
  knowledgeBId?: string;
  evidenceId?: string;
  reason: string;
  severity: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Resolved';
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}
export interface Audit extends Base {
  actor: string;
  entityId: string;
  action: string;
  detail: string;
}
export interface Notification extends Base {
  message: string;
  href: string;
  read: boolean;
  userId?: string;
}
