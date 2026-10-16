// Frontend-side TypeScript types mirroring backend/prisma/schema.prisma in
// docforum-core. Keep in sync — see AGENTS.md doc-update table and hard
// rule 2 in ARCHITECTURE_ESSENTIALS.md ("don't invent parallel
// frontend-only shapes for the same entities").
//
// docforum-core's schema is still field-sparse (Phase 1 not started there
// — see its ROADMAP.md). Fields below marked "assumed" don't exist in
// schema.prisma yet; they're the smallest reasonable guess needed to build
// a signup form, not a confirmed contract. Reconcile this file once
// docforum-core actually defines them.

export type Role = 'patient' | 'doctor' | 'facility' | 'admin';

/** Roles a user may self-register as. Facility accounts are admin-invited
 * only (PRD OQ-2) — there is deliberately no self-serve facility signup. */
export type SelfServeRole = Extract<Role, 'patient' | 'doctor'>;

export interface User {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface PatientProfile {
  id: string;
  userId: string;
  fullName: string; // assumed — not yet in schema.prisma
  dateOfBirth?: string; // assumed — not yet in schema.prisma
}

export interface DoctorProfile {
  id: string;
  userId: string;
  fullName: string; // assumed — not yet in schema.prisma
  verificationStatus: VerificationStatus;
}

export type FacilityType = 'lab' | 'pharmacy';

export interface FacilityProfile {
  id: string;
  userId: string;
  name: string; // assumed — not yet in schema.prisma
  type: FacilityType;
}

// --- Dependents (Phase W2 — assumed, docforum-core#42 not landed yet) ------

export type Relationship = 'parent' | 'guardian' | 'carer';

export type HandoverStatus = 'not_eligible' | 'eligible' | 'invited' | 'claimed';

export interface Dependent {
  id: string;
  guardianProfileId: string;
  fullName: string;
  dateOfBirth: string;
  relationship: Relationship;
  handoverStatus: HandoverStatus;
  claimEmail?: string;
  claimInviteExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DependentInput {
  fullName: string;
  dateOfBirth: string;
  relationship: Relationship;
}

// --- Health profile (Phase W2 — assumed, docforum-core#59 not landed yet) ---

export type HealthSectionKey = 'allergies' | 'conditions' | 'medications';

export interface HealthEntry {
  id: string;
  patientProfileId: string;
  section: HealthSectionKey;
  name: string;
  details?: string;
  version: number;
  previousValue?: string;
  updatedAt: string;
  createdAt: string;
}

export interface HealthEntryInput {
  section: HealthSectionKey;
  name: string;
  details?: string;
}

// --- Acting-for profile (Phase W2 — client-only UI state + API scoping) ----

export interface ActingProfile {
  id: string;
  fullName: string;
  isSelf: boolean;
}

// --- Payments (Phase 5.5 in docforum-core — real, not assumed. See that
// repo's docs/adr/0004-custodial-payments-v1.md) ---------------------------
// Custodial v1: docforum-core holds its own Stellar identities; this repo
// never calls Stellar/docforum-escrow directly (hard rule 1 above).
// WalletLink is scoped to the facility (the on-chain payee), not a patient.

export interface WalletLink {
  id: string;
  facilityId: string;
  stellarPublicKey: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderTypeForPayment = 'prescription' | 'lab_order';
export type PaymentIntentStatus = 'created' | 'escrowed' | 'released' | 'refunded' | 'failed';

export interface PaymentIntent {
  id: string;
  orderType: OrderTypeForPayment;
  // Opaque — Prescription/LabOrder don't exist as real records in
  // docforum-core yet (Phase 4). Not validated against anything there.
  orderId: string;
  status: PaymentIntentStatus;
  patientProfileId: string;
  facilityId: string;
  // Raw stroops (native XLM's smallest unit), sent/received as a string
  // over JSON — matches docforum-core's BigInt field exactly, no
  // decimal/currency conversion.
  amountStroops: string;
  escrowId: string | null;
  stellarTxHash: string | null;
  sorobanContractId: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Availability slots (Phase W3 — `AvailabilitySlot` is a real
// docforum-core model; the manager-only fields are assumed) ---------------

export type SlotStatus = 'open' | 'held' | 'booked';

export interface AvailabilitySlot {
  id: string;
  doctorProfileId: string;
  status: SlotStatus;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  // Assumed: the manager needs the booked appointment behind a `booked`
  // slot (core's `AvailabilitySlot.appointment` 1:1 relation) to show what
  // a blocked range would take out. Not returned by the public list
  // endpoint today. See ARCHITECTURE_ESSENTIALS.md.
  appointment?: SlotAppointment | null;
}

/** Assumed projection of docforum-core's real `Appointment` model, scoped
 * to what the availability calendar renders. */
export interface SlotAppointment {
  id: string;
  status: AppointmentStatus;
  // Assumed: expanded patient identity for the doctor's own calendar. The
  // core model only carries `patientProfileId`.
  patientFullName?: string;
}

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

/** Mirrors the real `POST /availability/doctors/:id/slots/generate` body —
 * fixed-length, single-day, no recurrence (core ARCHITECTURE.md §6.3.6). */
export interface SlotGenerationInput {
  date: string; // 'YYYY-MM-DD'
  startHour: number;
  endHour: number;
  slotLengthMinutes: number;
}

export interface SlotGenerationResult {
  created: number;
  skipped: number;
  slots: AvailabilitySlot[];
}

/** Assumed (docforum-core#53 not landed): block a range, and remove a
 * single open slot. `conflicts` is the deliberate-handling list — the
 * backend reports booked appointments inside the range rather than
 * cancelling them. */
export interface BlockRangeInput {
  startTime: string;
  endTime: string;
  reason?: string;
}

export interface BlockRangeResult {
  blockedSlotIds: string[];
  conflicts: SlotAppointment[];
}

// --- Doctor verification (Phase W3 — assumed, docforum-core#52/#51 not
// landed) ------------------------------------------------------------------

export type CredentialType =
  | 'medical_license'
  | 'degree_certificate'
  | 'specialty_certificate'
  | 'identity_document'
  | 'other';

/** Items in a doctor's application are each verified individually
 * (docforum-core#51), so this is per-document/per-specialty, not the
 * profile-level `VerificationStatus`. */
export type ClaimItemStatus = 'pending' | 'verified' | 'rejected';

export interface DoctorCredential {
  id: string;
  doctorProfileId: string;
  type: CredentialType;
  /** Display label only. The backend stores a key behind a signed/get-on-demand
   * URL — never a permanent public URL, and never rendered as a link here. */
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: ClaimItemStatus;
  rejectionReason?: string | null;
  submittedAt: string;
  updatedAt: string;
}

/** Mirrors docforum-core's real, migrated `Specialty` model. */
export interface Specialty {
  id: string;
  name: string;
  slug: string;
}

/** Assumed (docforum-core#51): a specialty claim carries its own review
 * status — core's real `DoctorSpecialty` join table has no status column
 * yet. */
export interface SpecialtyClaim {
  id: string;
  doctorProfileId: string;
  specialtyId: string;
  specialty: Specialty;
  status: ClaimItemStatus;
  rejectionReason?: string | null;
  submittedAt: string;
  updatedAt: string;
}

// --- Prescriptions (Phase W2 — assumed, docforum-core#9 not landed) ------

/** Mirrors core's `OrderStatus` enum. */
export type OrderStatus = 'issued' | 'fulfilled' | 'expired' | 'superseded';

/** Mirrors core's Phase 0 `PrescriptionItem` placeholders (`drugName`,
 * `dosage`, `frequency`, `duration` are all free-text Strings there —
 * which is exactly why schedule derivation must degrade to showing them
 * as-is rather than guessing). */
export interface PrescriptionItem {
  id: string;
  drugName: string;
  dosage: string;
  /** Free text, e.g. 'every 8 hours', 'twice daily', 'as needed'. */
  frequency: string;
  /** Free text, e.g. '7 days', '2 weeks', 'ongoing'. */
  duration: string;
}

export interface Prescription {
  id: string;
  status: OrderStatus;
  createdAt: string;
  // Assumed relation fields — core's Prescription is `{id, status, createdAt}`
  // with these still TODO.
  patientProfileId: string;
  prescribingDoctorId: string;
  prescribingDoctorName?: string;
  items: PrescriptionItem[];
}

// --- Referrals (Phase W3 — assumed, docforum-core#5/#7 not landed) -------

/** Mirrors core's `ReferralStatus` enum. */
export type ReferralStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'expired';

/** Assumed (core `IntakeForm` is `{id, createdAt}` with `symptoms`/
 * `freeTextNotes` still TODO). This is the *snapshot copy* taken at
 * referral time — core's schema note is explicit that these must be copies,
 * not live references (ARCHITECTURE.md §4.4), and #41's review criterion is
 * that no live consultation-notes data is substituted for it. */
export interface ReferralIntakeSnapshot {
  id: string;
  symptoms: string[];
  freeTextNotes?: string;
  submittedAt: string;
}

/** Minimal referring-doctor projection (assumed expansion). */
export interface ReferringDoctor {
  id: string;
  fullName: string;
}

export interface ReferralSummary {
  id: string;
  status: ReferralStatus;
  /** Mirrors core's real `snapshotNotes` — the referring doctor's note,
   * frozen at referral time. */
  snapshotNotes: string;
  referringDoctor: ReferringDoctor;
  targetSpecialty?: Specialty | null;
  // Assumed: `snapshotTakenAt` is a distinct field from core's `createdAt`.
  // If the real API only exposes `createdAt`, reconcile here.
  snapshotTakenAt: string;
  createdAt: string;
  updatedAt: string;
  /** Mirrors core's TODO `resultingAppointmentId`. */
  resultingAppointmentId?: string | null;
  appointment?: SlotAppointment | null;
}

export interface ReferralDetail extends ReferralSummary {
  intakeSnapshot: ReferralIntakeSnapshot;
}

/** Assumed cursor-pagination envelope for list endpoints that page by
 * cursor rather than offset. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
