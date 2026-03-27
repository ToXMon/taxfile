# IRS E-FILE PROVIDER REQUIREMENTS: Comprehensive Legal Research
## For TaxFile Web Application (Next.js, PDF-Only, No Direct E-Filing)

**Research Date:** March 26, 2026  
**Sources:** IRS Publication 1345 (Rev. 12-2025), Publication 3112 (Rev. 11-2025), Publication 1436 (Rev. 10-2025), IRM 4.21.1, Form 8633, IRS e-Services Portal, IRS Security & Privacy Standards FAQs  
**Scope:** Federal IRS requirements only; NJ state e-file requirements are separate (NJ Division of Taxation)

---

## EXECUTIVE SUMMARY: WHAT TAXFILE SPECIFICALLY NEEDS

**CRITICAL FINDING:** As a web application that generates fillable PDFs for Form 1040 and NJ-1040 but does NOT electronically transmit returns to the IRS, TaxFile is NOT legally required to obtain an EFIN, register as an IRS e-file Provider, undergo fingerprinting, or comply with most IRS e-file program requirements.

IRS Publication 1345 explicitly states that its rules apply to "Authorized IRS e-file Providers" who participate in IRS e-file. Publication 1345 further exempts "Software Developers who do not engage in any e-file activity other than software development" from the EFIN requirement. Since TaxFile does not format data for IRS e-file transmission (it generates PDFs, not MeF XML), it falls outside the scope of the e-file program entirely.

**LEGALLY REQUIRED NOW:** Nothing under IRS e-file regulations (TaxFile does not transmit electronically)

**REQUIRED IF TAXFILE ADDS E-FILING:** Full e-file provider application, EFIN, fingerprinting, ATS testing, OSP security standards, continuing compliance

**BEST PRACTICES (NOT LEGALLY MANDATED FOR PDF-ONLY):** FTC Safeguards Rule compliance (WISP), data encryption, authentication, security headers — these are mandated by other laws (GLBA/FTC) if TaxFile handles taxpayer data as a financial institution

---

## 1. IRS PUBLICATION 1345 REQUIREMENTS

### Overview
Publication 1345, "Handbook for Authorized IRS e-file Providers of Individual Income Tax Returns" (Rev. 12-2025), is the primary rulebook governing participation in the IRS e-file program. It applies ONLY to entities that have been accepted as Authorized IRS e-file Providers.

**Citation:** IRS Publication 1345 (Rev. 12-2025), available at https://www.irs.gov/pub/irs-pdf/p1345.pdf

### Scope of Application
Pub. 1345 states it "provides rules and requirements for participation in IRS e-file by Authorized IRS e-file Providers filing individual income tax returns and related forms and schedules." (Pub. 1345, Introduction)

**Key point:** The publication governs PARTICIPATION in IRS e-file. A software tool that generates PDFs for manual filing or printing is not "participating in IRS e-file."

### Requirements for Software Developers (Chapter 5 & Chapter 6)
If a Software Developer IS an authorized e-file provider, Pub. 1345 requires:

1. **ATS Testing:** Must pass testing in the Assurance Testing System (ATS) as prescribed in Publication 1436
2. **Error Correction:** Must promptly correct and distribute fixes for software errors causing rejected electronic returns
3. **Signature Authorization:** Software must include IRS e-file Signature Authorization with proper language and version indicators for Consent to Disclose and Jurat statements
4. **Address Handling:** Must allow input of different addresses on forms/schedules when they differ from the taxpayer's address
5. **ITIN TIN Entry:** Must require manual key entry of TIN as it appears on Form W-2 for ITIN holders reporting wages
6. **Payment Voucher:** Must include a printable payment voucher
7. **IP Statement:** Must include the Internet Protocol (IP) statement
8. **Form 1040-SR:** If supporting Form 1040-SR, must use Form 1040 schema with appropriate indicator checkbox
9. **Direct Deposit Defaults:** Routing and account numbers must default to "XXXXXXXX" when taxpayer chooses not to use direct deposit
10. **Resale Prohibition:** If selling software for resale, must ensure original purchaser does not resell with their EFIN
11. **Online Filing Limits:** Software for Online Filing cannot transmit more than 5 electronic returns per package or file more than 10 returns from a single email address
12. **Electronic Signatures (Forms 8878/8879):** Must provide digital image of signed form, date/time of signature, IP address for remote transactions, disable identity verification after 3 failed attempts, tamper-proof records with secure access controls

**Citation:** Pub. 1345, Chapter 5 (Other Authorized IRS e-file Provider Activities) and Chapter 6 (IRS e-file Rules and Requirements)

### Relevance to TaxFile
**NONE of the above requirements apply to TaxFile in its current state.** These requirements apply only to Software Developers who are authorized e-file Providers — meaning they have applied, been accepted, and are formatting data for electronic transmission to the IRS via the Modernized e-File (MeF) system. TaxFile generates PDFs, not MeF-formatted XML.

---

## 2. EFIN (ELECTRONIC FILING IDENTIFICATION NUMBER)

### What Is an EFIN?
An EFIN is a unique number assigned by the IRS to firms that have completed the e-file application and passed a suitability check. It identifies the firm in all electronic filing transactions.

**Citation:** Pub. 3112 (Rev. 11-2025), Section on EFIN Assignment; IRS EFIN FAQ at https://www.irs.gov/e-file-providers/faqs-about-electronic-filing-identification-numbers-efin

### EFIN Exemption for Software Developers
**This is the most critical finding for TaxFile:**

> "All Authorized IRS e-file Providers need an EFIN, except Software Developers who do not engage in any e-file activity other than software development."
> — Publication 1345, Chapter 5 (EFIN Requirements section)

This means: If you ONLY develop software and do not transmit returns, you do not need an EFIN. **TaxFile, as a PDF generator, falls squarely within this exemption.**

**Note:** There is a tension with Pub. 3112, which states that all Providers (including Software Developers who apply) receive EFINs. The resolution is that Pub. 3112 describes the process IF you choose to apply as a provider. Pub. 1345 clarifies that applying is not mandatory for pure software developers who do not transmit. If you never apply, you never need an EFIN.

### The Complete Application Process (If Needed in Future)
If TaxFile later adds e-filing capability, here is the complete process:

**Step 1: e-Services Account Creation**
- All Principals and Responsible Officials must create an e-Services account (Secure Access)
- Requires identity verification via ID.me or existing IRS credentials

**Step 2: Complete Form 8633 (Online Application)**
- Access via e-Services > E-file Provider Services > Access e-file Application
- Enter firm identification (EIN, legal name, DBA, physical address, phone)
- Select Provider Options (e.g., Software Developer + Online Provider + Transmitter)
- Enter information for each Principal and Responsible Official
- Specify form types (1040, etc.)

**Step 3: Professional Credentials or Fingerprinting**
- Principals/Responsible Officials who are CPAs, attorneys, enrolled agents, officers of publicly traded corps, or bonded bank officials: provide professional credentials
- All others: must complete Livescan fingerprinting via IRS-authorized vendor

**Step 4: Attestation**
- Each Principal/Responsible Official answers personal questions
- Acknowledges privacy notices and Terms of Agreement
- Enters PIN under penalty of perjury

**Step 5: Submission & Suitability Check**
- Submit application, receive tracking number
- IRS conducts suitability check (up to 45 days)

**Step 6: Testing**
- Transmitters and Software Developers must complete ATS testing before final acceptance

**Step 7: Acceptance**
- IRS assigns EFIN and notifies applicant

### Timeline
- Application can be saved and completed at your own pace
- Suitability check: up to 45 days from submission
- ATS testing: opens annually (Oct 14, 2025 for TY2025); can take weeks depending on corrections needed
- Total timeline: typically 6-10 weeks

### Fees
**There is NO fee to obtain an EFIN.** The application, suitability check, and EFIN assignment are all free.

**Citation:** IRS EFIN FAQ: "Currently, there is no fee to obtain an EFIN."

However, there are indirect costs:
- Livescan fingerprinting: typically $30-75 per person (paid to fingerprinting vendor, not IRS)
- SSL certificates, vulnerability scanning, security infrastructure (if OSP)

### Form 8633 Details
Form 8633 is the "Application to Participate in the IRS e-file Program." Key fields:

- **Firm Details:** Firm type (sole prop, corp, LLC), EIN/SSN, legal name, DBA
- **Location:** Physical business address (NO P.O. boxes), mailing address if different, phone/fax
- **Provider Roles:** Check all that apply — ERO, Transmitter, Online Provider, Software Developer, ISP
- **Form Types:** 1040, 1040-NR, 1040-SS, 1040-X, 940, 941, 1120, etc.
- **Compliance Disclosure:** Must disclose if firm failed to file business returns or pay tax liabilities
- **Personnel:** Name, home address, SSN, DOB, citizenship, professional status for each Principal and Responsible Official
- **Criminal/Penalty Disclosure:** Preparer penalties, criminal convictions, failure to file personal taxes
- **Online Provider Addendum (if applicable):** Software brand, developer, transmitter, costs, website URL, contact info, procedures for 5-return/10-return limits

**Citation:** Form 8633 (Accessible version) at https://www.irs.gov/pub/irs-access/f8633_accessible.pdf

**Note:** The online e-Services application has largely replaced the paper Form 8633, but the paper form still exists and contains the same information requirements.

---

## 3. IRS E-FILE APPLICATION PROCESS (COMPLETE)

### Prerequisites
1. Valid EIN for the business (from IRS Form SS-4)
2. e-Services account for all Principals and Responsible Officials
3. Professional credentials OR ability to complete fingerprinting

### Step-by-Step Process

| Step | Action | Time | Notes |
|------|--------|------|-------|
| 1 | Create e-Services accounts (Secure Access/ID.me) | 30-60 min per person | All Principals + Responsible Officials |
| 2 | Access e-file application in e-Services portal | 5 min | Under "E-file Provider Services" |
| 3 | Enter firm information | 30-60 min | EIN, address, contacts |
| 4 | Select Provider Options | 10 min | Software Developer + any others |
| 5 | Enter Principal/RO information | 15-30 min per person | SSN, DOB, citizenship, credentials |
| 6 | Fingerprinting or credential submission | 1-3 days | Schedule Livescan appt or upload credentials |
| 7 | Attestation and PIN entry | 15 min per person | Under penalty of perjury |
| 8 | Submit application | Instant | Receive tracking number |
| 9 | Suitability check (IRS) | Up to 45 days | Credit, tax compliance, criminal, prior non-compliance |
| 10 | ATS testing (if Software Dev/Transmitter) | 1-4 weeks | Must pass all required scenarios |
| 11 | EFIN assignment | Upon passing | Acceptance letter mailed |

### Forms Needed
- **Form 8633** (now online via e-Services) — primary application
- **Professional credentials** (CPA license, EA card, bar membership) — if applicable
- **No separate fingerprint form** — scheduled electronically through application

### Total Timeline
- **Best case:** 6-8 weeks (clean application, no issues, quick ATS pass)
- **Typical:** 8-12 weeks
- **Worst case:** 3-6 months (if suitability issues, repeated ATS failures)

### Fees
- **Application:** $0
- **EFIN:** $0
- **Fingerprinting:** ~$30-75 per person (third-party vendor)
- **EV SSL Certificate:** ~$150-400/year (if Online Provider)
- **Vulnerability Scanning:** ~$0-500/year (some vendors free for basic scans)
- **Indirect:** Development costs to meet MeF XML schema requirements

**Citation:** IRS "Become an Authorized e-File Provider" at https://www.irs.gov/e-file-providers/become-an-authorized-e-file-provider; Pub. 3112 (Rev. 11-2025)

---

## 4. ONLINE SERVICE PROVIDER vs INTERMEDIATE SERVICE PROVIDER

### Definitions

**Online Service Provider (OSP):**
> "An Online Provider allows taxpayers to self-prepare returns by entering data directly into commercially available software, software downloaded from the Internet, or an online website."
> — Pub. 1345, Glossary; Pub. 3112, Provider Options

**Key characteristics:**
- Taxpayer enters data directly into the software/website
- It is a SECONDARY role — must also select a primary Provider Option (Software Developer, Transmitter, or ISP)
- Subject to additional security standards (the Six Supplemental Standards)
- Must use Extended Validation SSL certificates
- Must conduct weekly vulnerability scans
- Must implement challenge-response protocol (e.g., CAPTCHA)
- Must implement identity verification per NIST SP 800-63 Level 2
- Limited to 5 electronic returns per software package and 10 returns per email address

**Intermediate Service Provider (ISP):**
> "An Intermediate Service Provider receives tax return information from an Electronic Return Originator (ERO) or a taxpayer, processes that information, and either forwards it to a Transmitter or sends it back to the ERO or taxpayer for Online Filing."
> — Pub. 1345, Glossary; Pub. 3112, Provider Options

**Key characteristics:**
- Acts as a processor/middleman between ERO/taxpayer and Transmitter
- It is a PRIMARY role (unlike OSP, does not require another role)
- If purchases software for resale to EROs, classified as a "reseller"
- Prohibited from providing an EFIN with software packages sold to EROs
- For Online Filing: must use an EFIN beginning with 10, 21, 32, 44, or 53

### Where TaxFile Would Fall
**If TaxFile adds e-filing, it would be an Online Service Provider (OSP)** because:
- Taxpayers enter data directly into the web application
- It would need to also select Software Developer and/or Transmitter as primary roles
- It would be subject to ALL six OSP supplemental security standards

**If TaxFile only processes data and sends to a separate transmitter**, it could be an ISP — but this is unlikely to be the architecture.

### Requirements Comparison

| Requirement | OSP | ISP |
|-------------|-----|-----|
| Primary or Secondary Role | Secondary (needs another role) | Primary |
| EFIN Required | Yes (via primary role) | Yes |
| EV SSL Certificate | YES (mandatory) | Not specifically required |
| Weekly Vulnerability Scans | YES (mandatory) | Not specifically required |
| Challenge-Response Protocol | YES (mandatory) | Not specifically required |
| Identity Verification (NIST 800-63 L2) | YES (mandatory) | Not specifically required |
| Security Incident Reporting | YES (all providers) | YES (all providers) |
| Multi-Factor Authentication | YES (FTC Safeguards) | YES (FTC Safeguards) |
| Return Limits | 5 per package, 10 per email | No specific limits |
| Resale Restrictions | N/A | Cannot provide EFIN with sold software |

**Citation:** Pub. 1345, Chapter 5 and Chapter 6; Pub. 3112, Provider Options section

---

## 5. FINGERPRINTING, BACKGROUND CHECK, SUITABILITY

### Who Needs to Be Fingerprinted?

Every Principal and Responsible Official listed on the e-file application MUST be fingerprinted UNLESS they provide valid professional credentials as one of:

1. **Attorney** — in good standing with state bar
2. **Certified Public Accountant (CPA)** — current license
3. **Enrolled Agent (EA)** — valid enrollment number
4. **Officer of a publicly held corporation**
5. **Banking official** — bonded and fingerprinted within the last 2 years

**Important exception:** Licensed Public Accountants (LPAs) MUST be fingerprinted even if they have professional credentials.

**Citation:** Pub. 3112 (Rev. 11-2025), Fingerprinting section; IRS "Become an Authorized e-File Provider" page

### What Is a Principal?
Defined by business structure:
- **Sole proprietorship:** The owner
- **Partnership:** All partners with 5% or more interest
- **Corporation:** All corporate officers
- **LLC:** All members/managers with ownership interest
- **Large firms:** May substitute "Key Persons" who substantially participate in e-filing operations

### What Is a Responsible Official?
An individual with operational authority over the Provider's IRS e-file activities at a specific location. Responsibilities include:
- First point of contact with the IRS
- May be authorized to sign revised e-file applications
- Ensures compliance with revenue procedures, publications, and notices
- If overseeing multiple offices, must be able to fulfill duties for each (or additional ROs must be added)

**Citation:** Pub. 3112 (Rev. 11-2025), Definitions section

### Fingerprinting Process
1. Access the e-file Application Summary page after submitting the application
2. Use the scheduling link in the "Terms of Agreement Signature(s) & Personal Information" section
3. Each Principal/RO receives a unique link (cannot share)
4. Schedule appointment at an IRS-authorized Livescan vendor within 120-mile radius
5. Complete electronic fingerprinting at the scheduled location
6. Vendor transmits fingerprints to FBI for criminal history screening

### Background Check (Suitability Check) Coverage
The IRS suitability check includes:

1. **Tax compliance check** — Verifying tax returns are filed and balances due are paid or covered by installment agreement
2. **Criminal background check** — FBI fingerprint-based criminal history
3. **Credit check** — Financial responsibility assessment
4. **Prior non-compliance check** — Previous failures to comply with IRS e-file requirements

### Suitability Denial Grounds
The IRS may deny applications for:
- Criminal indictments or convictions
- Failure to file tax returns or pay tax liabilities
- Fraud penalties assessed
- Suspension or disbarment from tax practice
- Disreputable conduct
- Misrepresentation (including identity theft-related)
- Unethical practices
- Stockpiling returns (holding returns to file later for improper purposes)
- Association with denied or suspended entities

### Eligibility Requirements
Every Principal and Responsible Official must:
- Be a U.S. citizen or alien lawfully admitted for permanent residence
- Be at least 18 years old as of the application date
- Meet applicable state and local licensing/bonding requirements for tax preparation

### Application to TaxFile
**Currently: NOT APPLICABLE.** TaxFile does not need to apply as an e-file provider, so no fingerprinting or suitability check is required.

**If e-filing is added:**
- **Solo developer (no professional credentials):** Must be fingerprinted. You are both the Principal and Responsible Official.
- **Solo developer (CPA/EA/Attorney):** Can provide professional credentials instead of fingerprinting.
- **Company with multiple people:** All Principals and Responsible Officials need either credentials or fingerprinting.

**Citation:** Pub. 3112 (Rev. 11-2025); IRS "Become an Authorized e-File Provider" at https://www.irs.gov/e-file-providers/become-an-authorized-e-file-provider

---

## 6. TECHNICAL REQUIREMENTS

### IRS e-File System Architecture
The IRS uses the **Modernized e-File (MeF)** system for individual income tax returns (Forms 1040, 1040-NR, 1040-SS, 1040-X, etc.). MeF is a web-services based system using SOAP/XML.

**Key publications:**
- **Publication 4164** — "Modernized e-File (MeF) Guide for Software Developers and Transmitters" — communication procedures, transmission formats, business rules, validation procedures
- **Publication 1436** — "Assurance Testing System (ATS) Guidelines for Modernized e-File (MeF) Individual Tax Returns"

**Citation:** Pub. 4164 at https://www.irs.gov/pub/irs-pdf/p4164.pdf; MeF User Guides at https://www.irs.gov/e-file-providers/modernized-e-file-mef-user-guides-and-publications

### XML Schema Requirements
All returns must be submitted in IRS-approved XML format:
- Must conform to valid schema versions published by IRS
- Tax Year 2025 schemas available at: https://www.irs.gov/tax-professionals/tax-year-2025-modernized-e-file-schema-and-business-rules-for-individual-tax-returns-and-extensions
- IRS strongly recommends running each return against an XML parser prior to transmission
- Test SSNs use "00" as 4th and 5th digits
- Must include valid IP address in Return Header schema

### ATS Testing Process (Publication 1436, Rev. 10-2025)

**Prerequisites:**
- ETIN (Electronic Transmitter Identification Number)
- EFIN
- Contact e-Help Desk to begin testing

**Process:**
1. Complete Software Identification Number questionnaire
2. Submit checklist of supported forms/schedules (identify any limitations)
3. Transmit required test scenarios
4. Review acknowledgment files for errors
5. Correct and retransmit as many times as needed (no limit)
6. Once clean: send one final message with one or more submissions
7. After passing: may self-test additional conditions using test ETIN

**Required Scenarios for Tax Year 2025:**
- 6 test returns for Form 1040
- 1 test return for Form 1040-SS
- 1 test return for Form 4868
- 4 test returns for Form 1040-NR (if participating)

**Timeline:**
- ATS opens: October 14, 2025 (for TY2025)
- Must complete before being accepted into MeF Program for the filing season
- Developer ETIN stays in "Test" status permanently (can test year-round)

**A2A (Application-to-Application) Transmission:**
- Must register systems to obtain a System ID
- Additional technical requirements for direct system-to-system communication

**Citation:** Pub. 1436 (Rev. 10-2025) at https://www.irs.gov/pub/irs-pdf/p1436.pdf

### Electronic Signature Requirements
For Forms 8878/8879 electronic signatures, software must:
- Provide digital image of the signed form
- Record date and time of signature
- Record IP address (for remote transactions)
- Record username
- Record identity verification results
- Disable identity verification after 3 failed attempts
- Operate within a secure portal
- Produce tamper-proof records with secure access controls
- Reproduce legible hardcopies

### What This Means for TaxFile
**Currently:** TaxFile generates PDFs, not MeF XML. None of these technical requirements apply.

**If e-filing is added:** TaxFile would need to:
1. Build an MeF XML generation engine (separate from the PDF generation)
2. Implement SOAP/XML communication with IRS MeF web services
3. Obtain ETIN and EFIN
4. Pass all 8 ATS test scenarios (6 for 1040 + 1 for 1040-SS + 1 for 4868)
5. Implement electronic signature capture per IRS requirements
6. Handle acknowledgment processing (accepted/rejected/partially accepted)
7. Build error correction workflows

---

## 7. CONTINUING REQUIREMENTS

### Error Rate Thresholds
**Important finding:** The IRS does NOT publish a specific numerical error/reject rate threshold in publicly available documents. The IRM 4.21.1 and Pub. 1345 reference an "unacceptable cumulative error or rejection rate" without defining the exact percentage.

What IS known:
- The IRS monitors reject rates and uses them as a basis for targeted monitoring visits
- "Unacceptable cumulative error or rejection rate" is explicitly listed as a sanctionable offense
- The purpose of ATS testing is to ensure returns have "few validation or math errors"
- Industry understanding (not officially confirmed): a reject rate consistently above 5-10% may trigger monitoring

**Citation:** IRM 4.21.1 (Monitoring the IRS e-file Program) at https://www.irs.gov/irm/part4/irm_04-021-001r

### Three-Tier Infraction System

**Level One (Minor):**
- Little or no adverse impact on e-file quality
- Limited government impact, no negative media impact
- Self-corrected procedural infractions
- Example: Minor advertising violation corrected immediately
- **Sanction:** Written warning

**Level Two (Serious):**
- Adverse impact on e-file quality or IRS e-file
- Media impact, negative taxpayer impact
- Voluntary compliance issues, substantial omissions
- Intentional disregard, misrepresentation
- Non-compliance not self-corrected
- Continued Level One infractions
- Example: Transmitting returns before obtaining taxpayer signatures; failing to update application after RO change
- **Sanction:** Written reprimand or proposed suspension (1 year)

**Level Three (Major):**
- Significant adverse impact on e-file quality
- Continued Level Two infractions after notification
- Fraud, association with known criminals
- Monetary or fiduciary crimes
- Failure to cooperate with IRS monitoring
- Signing for taxpayer without authorization
- Directing refund to preparer's bank account
- **Sanction:** Immediate suspension (2 years) or expulsion

**Citation:** IRM 4.21.1, Exhibit of Infraction Levels

### Monitoring Process
- **Preplanning:** IRS selects providers for visits (random, targeted based on risk/high reject rates, follow-up, referral)
- **Contact:** IRS contacts provider to schedule visit
- **Interview:** Principal, primary contact, or Responsible Official
- **Review:** Records, files, Forms 8879, advertising, office procedures
- **Findings:** Summary of Findings issued, or written warning/reprimand if applicable

### Renewal Process
**There is NO annual renewal required.** Providers do not need to reapply each year if they:
- Continue to e-file returns
- Continue to comply with suitability requirements

**However, ongoing obligations include:**

1. **Inactivity Rule:** If a Provider does not e-file returns in the current AND prior processing year, IRS may notify them of removal. Must reply within 60 days to request reactivation or reapply.

2. **30-Day Update Rule:** Must revise the e-file application within 30 days of any change to:
   - Principals
   - Responsible Officials
   - Business address
   - Telephone numbers
   - Any other material information

3. **3-Day Website Update Rule:** Any changes to website URLs used to collect taxpayer information must be updated within 3 business days.

4. **Continuous Suitability Monitoring:** All Providers (except those solely functioning as Software Developers) are subject to ongoing suitability monitoring.

5. **Security Incident Reporting:** All Providers must report security incidents per Standard Six. If a website is the proximate cause, must cease collecting taxpayer information via that site until resolved.

### The Six Supplemental Security Standards (OSP Only)

These apply ONLY to Online Providers of individual income tax returns. They supplement the Gramm-Leach-Bliley Act (GLBA) requirements:

| # | Standard | Requirement | Frequency |
|---|----------|-------------|-----------|
| 1 | Extended Validation SSL | EV SSL certificate using TLS 1.2+ with minimum 2048-bit RSA/128-bit AES | Continuous |
| 2 | Vulnerability Scanning | Weekly external network vulnerability scans by independent third-party vendor per PCI DSS | Weekly |
| 3 | Challenge-Response Protocol | Effective bot detection (e.g., CAPTCHA) to prevent automated bulk fraudulent submissions | Continuous |
| 4 | Identity Verification | Per NIST SP 800-63, Level 2 assurance with knowledge-based authentication or higher | Per transaction |
| 5 | Multi-Factor Authentication | MFA for all access to systems handling federal tax information | Continuous |
| 6 | Security Incident Reporting | Report security incidents to IRS; cease data collection if website is compromised | As needed |

**Additional GLBA/FTC Requirements (apply to all tax professionals as financial institutions):**
- Written Information Security Plan (WISP) — see IRS Publication 5708
- Data encryption (at rest and in transit)
- Access controls
- Employee training
- Risk assessment
- Vendor management

**Citation:** Pub. 1345, Chapter 6 (Six Supplemental Standards); IRS Security & Privacy Standards FAQs; IRS Publication 5708; FTC Safeguards Rule

---

## SUMMARY TABLE: REQUIREMENTS vs TAXFILE STATUS

| Requirement | Legally Required for TaxFile Now? | Required If E-Filing Added? | Source |
|-------------|-------------------------------------|------------------------------|--------|
| EFIN | NO (PDF-only exemption) | YES | Pub. 1345 Ch.5 |
| Form 8633 / e-Services Application | NO | YES | Pub. 3112 |
| Fingerprinting | NO | YES (unless CPA/EA/Attorney) | Pub. 3112 |
| Suitability Check | NO | YES | Pub. 3112 |
| ATS Testing | NO | YES (Software Dev role) | Pub. 1436 |
| MeF XML Schema Compliance | NO | YES | Pub. 4164 |
| ETIN | NO | YES | Pub. 1436 |
| EV SSL Certificate | NO | YES (if OSP) | Pub. 1345 Ch.6 |
| Weekly Vulnerability Scans | NO | YES (if OSP) | Pub. 1345 Ch.6 |
| Challenge-Response (CAPTCHA) | NO | YES (if OSP) | Pub. 1345 Ch.6 |
| Identity Verification (NIST L2) | NO | YES (if OSP) | Pub. 1345 Ch.6 |
| MFA | NO (but FTC may require) | YES | FTC Safeguards Rule |
| Security Incident Reporting | NO | YES | Pub. 1345 Ch.6 |
| WISP (Written Info Security Plan) | MAYBE (if handling taxpayer data as financial institution under GLBA) | YES | FTC/GLBA, Pub. 5708 |
| Data Encryption | MAYBE (FTC Safeguards) | YES | FTC/GLBA |
| Error Rate Compliance | NO | YES | IRM 4.21.1 |
| Annual Renewal | NO | NO (continuous) | Pub. 3112 |
| 30-Day Change Updates | NO | YES | Pub. 3112 |
| 3-Day Website URL Updates | NO | YES (if OSP) | Pub. 3112 |

---

## NJ STATE E-FILE REQUIREMENTS (BRIEF NOTE)

This research covers only IRS/federal requirements. New Jersey has its own e-file program with separate requirements administered by the NJ Division of Taxation. The NJ program generally follows IRS Pub. 1345 requirements (per FTB/NJ publications) but has additional state-specific forms, testing, and registration requirements. A separate research effort would be needed for NJ state e-file provider requirements.

**Citation:** California FTB Publication 1345 (referenced as model for state programs); NJ Division of Taxation e-file program materials

---

## RECOMMENDED PATH FOR TAXFILE

### Phase 1: Current State (PDF-Only) — No IRS E-File Action Needed
- Focus on security best practices under FTC Safeguards Rule/GLBA
- Implement WISP (Written Information Security Plan) — see IRS Publication 5708
- Address security audit findings (authentication, encryption, headers, etc.)
- Ensure PDFs are accurate and compliant with IRS form specifications

### Phase 2: Pre-E-File Preparation
- Begin e-Services account creation for all Principals/Responsible Officials
- Decide on provider roles: likely Software Developer + Online Provider + Transmitter
- Begin security infrastructure: EV SSL, vulnerability scanning, MFA, CAPTCHA
- Start MeF XML schema development (parallel to PDF generation)

### Phase 3: E-File Application
- Submit e-file application (Form 8633 via e-Services)
- Complete fingerprinting (if no professional credentials)
- Wait for suitability check (up to 45 days)

### Phase 4: Testing & Launch
- Complete ATS testing (6 Form 1040 scenarios + 1 1040-SS + 1 4868) Implement acknowledgment processing
- Launch e-filing capability
- Begin ongoing compliance monitoring

---

*This document is for informational purposes and does not constitute legal advice. TaxFile should consult with a tax attorney or IRS-authorized specialist before making compliance decisions.*
