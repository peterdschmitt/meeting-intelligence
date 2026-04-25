import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { companies, contacts, meetings, actionItems } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const SEED_DATA = [
  {
    "title": "Conversely AI meeting",
    "date": "2026-04-24",
    "time": "2026-04-24 3:00 PM - 3:30 PM (EDT)",
    "platform": "Teams",
    "participants": [
      "Josie Van Pelt",
      "Larry Blumenstyk",
      "Sev Paso",
      "Tim Collopy",
      "Xiaobing Yang",
      "Michael Ro",
      "Peter Schmitt",
      "Mike"
    ],
    "summary": "The meeting reviewed a proposal to deploy Conversely\u2019s conversational AI to reduce high hang-up and missed-agent rates on inbound calls originating from TV, CTV and other channels and to automate follow-up across paid channels. The team defined three operational swim lanes: automated SMS follow-ups for quick hang-ups, AI re\u2011qualification for warm-transfer leads with a short-duration payout threshold, and after-hours virtual-agent handling and appointment scheduling. Participants confirmed Conversely can support the hang-up and qualification journeys via its campaign-management system and virtual-agent fronter, and requested a demo using test records focused on the hang-up use case. Discussion covered operational details and constraints: the system can cue outbound calls and transfer to agents, and notifications can be sent via API pings, CRM alerts, or dialer integration; TCPA, carrier approval, blacklists, and consent/compliance were emphasized. Quantified goals included recovering no",
    "action_items": [
      {
        "assignee": "Josie Xiaobing",
        "task": "Josie Xiaobing will present the campaign-management demo showing hang-up and qualification journeys using test records"
      },
      {
        "assignee": "Josie Xiaobing",
        "task": "Josie Xiaobing will demonstrate the hang-up campaign scenario during the demo to validate the proposed funnel for quick hang-ups"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will verify TCPA rules and carrier compliance requirements offline and report back"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Mike will call the provided demo number to experience the virtual agent"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Mike will provide a qualification logic tree and script within 24 hours"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will draft a proposal based on the scoping scenarios and constraints discussed"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will review the call recordings dataset that Sev provided and incorporate insights into the proposal"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is the under-10-second call-duration threshold referring to calls that originated from TV campaigns or to calls that may have been returned later from the user\u2019s call history?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "From Conversely\u2019s experience, have you handled high hang-up rates for verticals similar to tax settlement and can the AI manage non-happy-path qualification?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can we walk through a demo that specifically shows how calls that hang up are handled?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do we need to integrate into our dialer, or will you notify and/or dial on our behalf?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How many texts can we send and what consent is required under TCPA for initial outreach?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are there backend databases we can query to confirm a consumer's IRS lien or related financial data for qualification?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "On after-hours, would you want callers to go through the same qualification process as live transfers?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do you have any sense of how many calls you're missing over after hours?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The core problem is a 40\u201350% hang-up rate on inbound calls from TV/other channels that requires automated follow-up to recover missed opportunities."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team wants a funnel that triggers an automated text when call duration is below a threshold and different messages depending on whether an agent was reached."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Calls come from multiple channels (TV, CTV and others) and often appear in call history as generic numbers, which reduces callback likelihood."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conversely can provide both a virtual-agent fronter and text-based campaign flows to qualify callers and manage journeys until a live transfer or scheduled appointment."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Mike outlined three swim lanes to prioritize: quick-hangup text follow-up, AI qualification for warm transfers with a payout condition, and after-hours virtual-agent handling with appointment scheduling."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conversely proposed using its campaign-management system to run that qualification and follow-up logic and to persist journeys until contact is made or attempts expire."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team requested a demo that shows the hang-up scenario and the campaign flows using test records to validate the approach for the tax-resolution vertical."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The AI agent will send SMS follow-ups, schedule callbacks, place calls, and transfer customers to live agents when they pick up"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Notifications to client agents can be implemented via API pings, CRM alerts, or direct dialer integration depending on the client's preference"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Express consent is required before sending SMS and the team must confirm TCPA compliance for initial outreach flows"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Carrier approval (not just regulatory) may be required and can take additional steps to secure Operational access for large-scale messaging"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Recovering calls that hang up within ~10 seconds is the highest-priority opportunity given a ~40% non-connect rate"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "For warm transfers, the AI agent should revalidate key qualification points quickly (ideally within the three-minute window) to avoid unnecessary billing to call centers"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Mike will provide a qualification logic tree/script to enable the AI to revalidate callers before transfer"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim will draft a proposal after reviewing the scoping scenario homework"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The after-hours swim lane will be easier to implement because it starts with a fresh qualification and can offer scheduled callbacks"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The highest immediate priority is swim lane one: contacts that hung up and were not reached"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team must expand digital lead follow-up in parallel with fixing inbound gaps"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Competitors in the tax-settlement space spend heavily on omnichannel acquisition, which motivates rapid scale-up"
      }
    ]
  },
  {
    "title": "FW: True Choice Morning Huddle",
    "date": "2026-04-24",
    "time": "2026-04-24 10:30 AM - 11:00 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Jon Maso",
      "Katy Martinez",
      "Peter Schmitt"
    ],
    "summary": "The meeting reviewed recent sales performance, lead-source troubleshooting, dashboard improvements, vendor opportunities, and new-agent readiness. The team discussed a poor performance day reported by Jon (three deals, low close rate, high CPA) in the context of week-to-date billables and average premium; weekly CPA was about $200 and month-to-date CPA was $198, with 19 policies sold this week and variability from agent absences. The group identified an unusually high immediate-disconnect rate on Health is Wealth (HIW) calls, agreed to press HIW to remove those disconnects from RPC calculations, and considered scaling other call sources by re-enabling an ulti source and reducing HIW live-call counts. Peter demonstrated a dashboard redesign showing commission status, agent availability, pause time, and carrier/agent drilldowns and asked Jon and Mike to review commission ingestion logic because of discrepancies between \u201cactive in force\u201d and commission-paid statuses. Jon committed to purs",
    "action_items": [
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will have Smart Financial send the intake form and required paperwork to Katy for review."
      },
      {
        "assignee": "Katy Martinez",
        "task": "Katy Martinez will review the Smart Financial contract and any other new lead-source agreements and flag problematic language."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jon Maso and Mike will review Peter\u2019s dashboard commission-ingestion and reconciliation issues with Peter over the weekend at a mutually convenient time."
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will move forward with Smart Financial setup and attempt to have them ready to go by Monday."
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will turn on Sherpa Digital, Scale-Up Media, and Nolte as additional lead sources."
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will provide daily status updates to Katy Martinez on carrier approvals for the two new agents (AIG and American Amicable) until approvals are resolved."
      },
      {
        "assignee": "Katy Martinez",
        "task": "Katy Martinez will coordinate a team review of Michael\u2019s call practices using dashboard data so the group can adopt effective techniques"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will keep Katy Martinez updated on the outcome of the conversation with the health lead source"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will activate Sherpa and ScaleUp when agent capacity allows, targeting next Monday"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is the current status of the conversation and relationship with Health is Wealth and other lead sources, including new marketplaces that require pre-funding?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Was the previously problematic contract the Smart Financial agreement?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is the latest status for onboarding the two new agents and their carrier approvals?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is Bill 100% back and available for training?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is Connie back?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do you want Katy to review the reply before Jon sends it?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team had a low-performance day with three deals, low close rate, high CPA, and many calls originating from the HIV/HIW driver that showed a high rate of immediate disconnects."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jon plans to re-enable an ulti source and reduce HIW live-call concurrency to one or two CC to diversify volume."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "HIW\u2019s immediate-disconnects (~22%) are inflating attempted-call counts and the team requested HIW remove those from RPC calculations."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Several new lead partners (Smart Financial, Sherpa Digital, Scale-Up Media, Nolte) are ready but require funding, signed intake/agreements, or contract review before going live."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter updated the dashboard with more detailed disposition and commission-status reports and asked Jon and Mike to review ingestion and reconciliation issues."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The dashboard reveals agent pause-time and availability issues (e.g., Bill paused 36% of time), which the team identified as a material driver of low sales on the poor day."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jon will attempt to get Smart Financial to accept the team\u2019s lead contract but expects they may insist on using their agreement."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Two new agents are ready pending carrier approvals (AIG, American Amicable); AIG approval timelines range from three to eight business days per recent updates."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Bill and Connie have returned to work, and Bill's higher pause time is due to training new agents via live shadowing and debriefs."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Pause time for Bill is expected to decrease within a few days as new agents require less explanation."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Weekly CPA was approximately $200 and month-to-date CPA was $198, indicating acceptable cost trends despite limited sales volume."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team sold 19 policies this week, averaging about 4.5 per day, with production affected by recent agent absences."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Michael is the top performer and his techniques inform script and process changes, but he is not used for live shadowing to avoid pressuring his performance."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Katy asked to be informed immediately about any decision from the health lead source to wind down traffic so backups can be stood up quickly."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jon confirmed Anolte has been used as a lead source and said Sherpa and ScaleUp are available to be activated when staffing allows."
      }
    ]
  },
  {
    "title": "Daily pipeline updates",
    "date": "2026-04-24",
    "time": "2026-04-24 9:00 AM - 9:30 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Larry Blumenstyk",
      "Tim Collopy",
      "Xiaobing Yang",
      "Peter Schmitt",
      "Katy Martinez",
      "Anya Kiseleva"
    ],
    "summary": "The meeting reviewed reconciliation of multiple UHC data sources and a related commission mismatch problem, then moved into virtual-agent testing, product requirements, and near-term commercial items. The team described three mapping inputs\u2014CRM policy exports, UHC business summaries, and monthly commission statements\u2014and acknowledged carrier-specific posting timing and statement timing create guaranteed discrepancies that cannot be solved purely by mapping; the conclusion was that process controls are required alongside technical mappings. Practical mapping difficulties were noted and prior mapping work and experience shared. Discussion of pipeline and trade-show leads covered HubSpot prioritization, partners, and a near-term focus on CareSource and Apollo, with CareSource scoped for phase-one QA on ACA and Medicare sales calls. Virtual-agent testing examined Troy and TrueChoice scripts, test-call behavior, eligibility edge cases, and surfaced recordings and dashboard data for analysis",
    "action_items": [
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will implement the proposed mapping solution for the UHC data sources and prepare it for review."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will add the prioritized conference leads into HubSpot and mark near-term nurture items."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will call Tim Collopy before the next meeting to provide additional information and follow up on scheduling."
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will go back and listen to the Troy test calls to validate eligibility and script behavior."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will forward the AI script email (Tuesday 3:30 p.m.) to Larry Blumenstyk."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will give the Choice version to SAV for testing."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will dust off the \u201ctalking head\u201d asset and confirm whether it works for demos."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will forward the virtual agent phone number to Tim Collopy via Teams or email"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will tweak the project-plan draft from Anya and send the revised version to the client (Assured)"
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will follow up with Michael at Solar Optimum to request a conversation and clarify points of contact"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will demonstrate the updated tracking of virtual agent minutes, transfers, and costs to Tim Collopy for feedback"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will cancel the existing calendar invite and create the alternative invites discussed earlier in the week"
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will take ownership of client communication and lead the scorecard effort."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will have Anya validate whether the client's conversion flag matches the call recordings for EC/sales designation."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will call Anya and bring her into the review to examine recent ACA sales scorecard calls."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will copy Larry on the follow-up with Anya when he reviews the calls."
      },
      {
        "assignee": "Anya Kiseleva",
        "task": "Anya Kiseleva will review calls from this week in the ACA sales scorecard queue and send five to six obvious non-sales examples with recording IDs and caller IDs."
      },
      {
        "assignee": "Anya Kiseleva",
        "task": "Anya Kiseleva will look up caller IDs and check for other associated calls to determine if recordings are grouped."
      },
      {
        "assignee": "Anya Kiseleva",
        "task": "Anya Kiseleva will also produce a separate list of calls that are only dental enrollments."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will provide Sev with a number so Sev can make a call before the next meeting."
      },
      {
        "assignee": "Anya Kiseleva",
        "task": "Anya Kiseleva will call Larry on a separate line to demonstrate how she is researching assured calls. (01:00:42)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Which client are we discussing for mapping and commissions?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How common are commission discrepancies when reconciling statements?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is the dashboard refresh timing for calls getting loaded into the system?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Were you on the call Peter had with Sev earlier this week?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Did Sev explicitly say he\u2019s interested in video sent over SMS?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What did Assured ask for regarding the expanded call types and coordination?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What are you focused on today related to the virtual agent tracking?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Will Larry take ownership of client communication and start communicating with them?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What examples should Anya put together when reviewing calls?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do calls that enroll only in dental insurance count as ACA for this review?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter and Mike have prior mapping work that could be shared to accelerate the UHC reconciliation effort."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team must map three UHC data sources\u2014CRM exports, UHC business summaries, and monthly commission statements\u2014which currently do not align cleanly."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Carrier statement timing and carrier-specific posting create frequent commission discrepancies that require process controls."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim identified prioritized sales leads from the conference to nurture in HubSpot and marked several for near-term follow-up."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "CareSource committed to an initial phase of QA on ACA and Medicare calls to provide agent coaching insights."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Apollo is a reactivated pipeline opportunity to test VAs against domestic outbound agents for warm transfers."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Troy and TrueChoice VA tests revealed script and eligibility inconsistencies that need investigation and fixes."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing proposed giving the Choice version to SAV for testing because it feels more natural and is safer than production testing."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Dashboard refresh timing for call ingestion is currently unknown and needs to be confirmed."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Sev expressed interest in sending video content over SMS, which the team believes would require HeyGen for production."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The client-requested \u201cinteractive agent\u201d and \u201cvideo over SMS\u201d are technically separate capabilities and may have been conflated by the client in email communications."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The HP1 opportunity was previously modeled at $49 per agent per month for 500 seats and remains viable though margin is moderate."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Integration with Nice is an open technical risk for HP1 that requires clarification during the 11:30 call."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Multiple new prospective clients from the show are interested in the virtual agent, increasing urgency to validate and optimize the product."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing will forward the virtual agent phone number to Tim and the team plans to test the number."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Larry will prioritize building client-specific, goal-oriented project plans to enable deeper, value-focused conversations with clients."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team is tracking VA AI minutes, transfer minutes, and costs to assess true call economics and reporting."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team observed that ACA and live calls may be mixed together in the system and asked for validation from call review."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Uploaded call types reflect the client-provided labels; the team does not independently determine call type in the upload process."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Agent name fields may indicate agents are assigned to multiple teams, which could explain apparent misclassifications."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Larry will take ownership of client communication and use the project plan to fill gaps in understanding."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team will create a generic initial scorecard for ACA calls that the client can adjust, while Alliant controls the mandated ACA sales QA scorecard."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team wants to verify that the client's conversion flag aligns with the actual call recording and to group related recordings when necessary."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Anya will review recent ACA sales scorecard queue calls and produce example non-sales recordings with recording IDs and caller IDs."
      }
    ]
  },
  {
    "title": "FW: True Choice Morning Huddle",
    "date": "2026-04-23",
    "time": "2026-04-23 10:30 AM - 11:00 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Jon Maso",
      "Mike Hecker"
    ],
    "summary": "The meeting reviewed staffing and carrier onboarding work alongside commission reporting and dashboard ingestion processes to align operational tasks and data status. The team confirmed a new training class that is currently shadowing Bill and will not go live until carrier appointments are completed. On policy financials, the group agreed to pursue a 5% reconciliation on already-paid policies; Becca was identified as the likely lead to resolve the reconciliation with CICA, and Jon will support by providing March screenshots relevant to the issue. Discussion then moved to commission statement processing and dashboard ingestion. Jon demonstrated how to sync Google Drive files and how to process new commission statement files, and he offered to process any outstanding files each morning if needed. The team noted that status fields on exported policy data were updated earlier in the week by Bill; Carrie will take over maintaining those status updates going forward, with Jon available to f",
    "action_items": [
      {
        "assignee": "Peter Schmitt",
        "task": "Mike will reply to Becca and Jon on the email thread about the 5% reconciliation"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will process the 41 new commission statement files shown in the dashboard"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Carrie will continue updating policy status fields using the video Bill provided"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will check with Carrie to confirm she is updating policy status fields and will step in if she has not"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is the new class that was mentioned and what are they doing?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "When will the new class go live?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Has there been any discussion about recovering the 5% difference on policies already paid?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Who should lead the reconciliation with CICA\u2014Becca or Jon?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How do we get carrier statements from Google Drive into the dashboard?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A new class is in training and currently shadowing Bill while awaiting carrier appointments to go live."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team agreed to request a 5% reconciliation on already-paid policies and to escalate to Becca as the likely lead."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Commission statement files should be uploaded to the shared Google Drive and then processed from the dashboard sync page."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jon demonstrated the dashboard workflow and offered to process 41 new commission statement files for Mike."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Policy status fields were updated earlier in the week and Carrie is expected to maintain those updates going forward."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jon will check with Carrie and step in if the status updates are not being kept current."
      }
    ]
  },
  {
    "title": "Daily pipeline updates",
    "date": "2026-04-22",
    "time": "2026-04-22 9:00 AM - 9:30 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Larry Blumenstyk",
      "Tim Collopy",
      "Xiaobing Yang",
      "Peter Schmitt"
    ],
    "summary": "The meeting reviewed recurring live call-quality and transfer problems after recent Friday changes, focusing on measurable customer impact and consistent evaluation criteria. The team discussed high rates of calls flagged by Larry and Anya for long pauses and other friction, and agreed to compare assessments to align objectivity and adopt a \"customer frustration\" lens rather than a perfection standard for notes and audits. Conversation shifted to product and operational fixes for the virtual agent and transfer flow, including a proposed switch from cold transfers to warm transfers with a callback fallback when transfers fail. Participants debated how to measure transfer accept/answer rates in production and whether to run test calls, and identified gaps in visibility after transfers plus missing campaign-level reporting and dashboards for new call types. The group also addressed a VA voice-behavior incident characterized as an AI hallucination that caused the model to play two roles; g",
    "action_items": [
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will find and share Anya\u2019s email with the team"
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will review the same calls as Anya and compare his assessment to hers to help calibrate call-quality judgments"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will finish testing the virtual agent changes and push them to production only after additional tests"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will write up findings about John's email changes and reply to stakeholders with what he found and what he changed"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will implement or design a warm-transfer flow and a fallback that captures contact information and schedules callbacks when transfers fail"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will send Cody a link and grant him access to test reports, commissions, and business-summary files today"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will reach out to Brad to review the SMS site and confirm languages and readiness for submission"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Brett will submit the SMS/carrier approval through TextGrid to obtain outbound-calling/SMS approval"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will set up customer reports for the three new call types on the dashboard and complete the remaining regional list items"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will send an update on all opportunities to the team tomorrow (or the next scheduled update)"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will schedule the demo/meeting with Sev and his contact around Peter\u2019s availability"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will call the contact at Qualphone as part of follow-up outreach"
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will continue digging into VA test results and report back on additional findings"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will resend the API URL, API key, API documentation, and agent IDs to Peter Schmitt"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Cody will submit a TextGrid campaign approval through TypeScript for the test campaign"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will reach out to Cody to have him review the consent language and submit the campaign approval"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What made you think there are consistency issues with call performance?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are the call issues the same as before or new after the changes?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do these campaigns warrant a warm transfer versus a cold transfer, and do we know accept/answer rates on the DID side?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Should we try making test calls in production to observe transfer behavior?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Has there been time spent to ensure our VA remains true to its designed voice and does not adopt customers' speech patterns or clone voices?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How is our VA performing and are the recent changes improving call handling?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How do I use the API and is there documentation and agent identifiers available?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team identified a continued, measurable percentage of calls with quality issues after Friday\u2019s changes and needs to calibrate objective criteria for good vs. bad calls."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Long pauses and similar issues appear to be the same recurring problems noted in prior testing rather than new regressions."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Anya will reassess calls using a customer-frustration lens, and Tim asked Larry to compare his assessments to Anya\u2019s to align judgments."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing proposed switching from cold transfers to warm transfers plus a callback fallback when the transfer fails to preserve leads and customer experience."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team lacks visibility on post-transfer behavior and accept/answer rates, creating uncertainty about whether problems are product, dialer, or staffing-related."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Cody will be granted system access to test commission and business-summary reports and will receive a link to start testing."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Brett (Predictive) will handle the carrier submission via TextGrid to obtain approval for outbound SMS/calls."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing will finish dashboard updates and set up customer reports for the three new call types to complete regional reporting."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter will send an update on opportunities if Tim is not on the next call, and Peter requested being part of the Sev demo due to VA relevance."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim will arrange a demo and follow-up meetings around the virtual agent opportunities with Sev and his contacts."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The meeting examined a reported external AI voice issue where nonstandard speech led to a shutdown and prompted review of protections against voice-cloning or pattern-emulation behavior."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing identified the root cause previously as AI hallucination playing two roles and described that guardrails and prompt changes were implemented to resolve it."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team needs a calibrated rubric for user experience to judge what VA behavior is acceptable when reviewing call audits."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A live test showed the VA handled clean calls well but hiccuped under background noise or ambiguous short answers, causing long silences in one test case."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim reported renewed VA sales opportunities with multiple companies, increasing the importance of stabilizing behavior before scaling."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing confirmed API documentation, keys, and agent IDs were provided by email and will be resent to Peter on request."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Cody prepared a TextGrid consent form and will submit a test campaign for approval to validate the TextGrid process and speed of approvals."
      }
    ]
  },
  {
    "title": "Daily pipeline updates",
    "date": "2026-04-21",
    "time": "2026-04-21 9:00 AM - 9:30 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Katy Martinez",
      "Larry Blumenstyk",
      "Mike Hecker",
      "Tim Collopy",
      "Xiaobing Yang",
      "Peter Schmitt"
    ],
    "summary": "The meeting reviewed pipeline status, recent deployments, operational follow-ups, and product validation for call-insights and virtual agent (VA) work. The team recapped submissions and deployments\u2014PSI self-assessment to Qualphone, three new call types live for National Media Connection, and Assured\u2019s new function with mixed call\u2011type tagging requiring intent and scorecard work\u2014and confirmed demos and prospect timelines in Las Vegas and for Preferred Hotels, Citizens Insurance, Monarch, and Troy. Peter requested a VA environment for Troy to be stood up by Friday to support buyer demos and materials, and the group weighed production cost versus dedicated environments. Operational items included a drafted contract (Katy to send), investigation of an AI disconnect on a VA call (Xiaobing to review recording), reinstating Chad\u2019s cancelled email (Tim and Peter coordinating with Jackie), Policy Guardian commission and UAC data preparations, and Cody refining pre\u2011existing condition rules. Tim ",
    "action_items": [
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will update and save the minutes tracker tomorrow after his IP access is cleared."
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will assist with Assured validation and related setup as he is up to speed on that client."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will provide Troy\u2019s prompts and coordinate final prompt decisions for the screener."
      },
      {
        "assignee": "Katy Martinez",
        "task": "Katy Martinez will draft and send the contract for Peter to get signed."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will review the VA call recording and confirm whether the AI disconnect feature failed and outline next steps."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will pursue pricing and arrange meetings with the HP1 product team regarding the request for pricing on ~70 million annual minutes."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Cody will refine the Policy Guardian rules to better filter plans based on pre-existing conditions."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will forward the TextGrid-related email to Katy Martinez for review."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will forward Cody\u2019s email about Aflac/API information to Katy Martinez and Peter Schmitt."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will ask Jackie to reinstate Chad\u2019s conversely email account."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will reactivate the conversely email account or ensure it is turned back on."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will inform John that the TrueChoice noon meeting should be canceled and that the team is looking into the VA issues."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Meeting participant will send the proactive agent link to Peter Schmitt so he can work on usability during travel."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is there an issue with Assured or with National Media Connection?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is Troy\u2019s timeline for delivery?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is our scope expected to include post\u2011call conversely insights in addition to the VA?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can someone send over a little contract that I can get them to sign?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Did you guys see the issue in the VA from John this morning?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are you questioning whether John is making this up about the AI disconnecting?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do we want to turn the conversely email back on or have them use another address?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How much of the UHC-specific logic can be reused for Aflac deployment?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do you agree we are at risk from people using phone calls plus Notebook LLMs or ChatGPT instead of our product?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can someone send me the proactive agent link so I can work on it on the plane?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim will update the minutes tracker tomorrow because his IP access was not cleared today."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The PSI self\u2011assessment attestation was completed and sent to Qualphone and a response is expected."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "National Media Connection deployed three new call types and may require cleanup and tweaks."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Assured deployed a new function and will send new call types that must be separated in the API call\u2019s call type field for correct processing."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Monarch has indicated readiness to move forward and the team will schedule a scope realignment call within the next few days."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Troy requires the virtual agent to be live by Friday to support his buyer outreach and deck commitments."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Katy committed to prepare and try to send a contract for signature."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team acknowledged a reported VA AI disconnect issue and will investigate the call recording today."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim received an urgent pricing request from HP1 for a large annual minutes volume and will pursue meetings and pricing."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing is loading UAC data and preparing commission files for Policy Guardian while Cody must refine rules for filtering plans by pre-existing conditions."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The TextGrid campaign approval practice raised liability concerns if customers change approved lead forms after launch."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Chad cannot access the conversely email because it was canceled, and Peter asked Jackie to reinstate it while Tim arranged to reactivate the account."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Larry found Solr summaries and coaching recommendations highly accurate and recommended mechanisms for agent acknowledgement and trend validation to prove behavior change."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team is concerned that clients can replicate basic value by using ChatGPT or Notebook LLMs unless proprietary insights are better packaged and demonstrated."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Summaries and insights currently rely on OpenAI models, so the product must combine extracted signal data into a unique presentation to show differentiated value."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Converting insights into measurable behavioral change requires short-cycle validation and alerts or virtual coaching tied to the next few calls."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "There are known data-quality issues causing miscounted billable calls and incorrect dispositions, and these must be isolated and fixed."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The group agreed to run topic-focused meetings (product roadmap, dev prioritization) to get beyond shallow daily huddles and deliver quicker product wins."
      }
    ]
  },
  {
    "title": "FW: True Choice Morning Huddle",
    "date": "2026-04-20",
    "time": "2026-04-20 10:30 AM - 11:00 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Jon Maso",
      "Katy Martinez",
      "Peter Schmitt"
    ],
    "summary": "The meeting reviewed inbound call routing, recent phone-line testing, operational and financial Friday results, recruiting, and telephony/CRM vendor options. Participants confirmed the main website number 855-696-5413 connected correctly after carrier registrations and anti-scam labeling changes, the virtual-agent prompt and caller flow worked during live tests, and some carriers still need to respond to follow-ups. Operational metrics for Friday were six sales, 23 billables, a CPA of $161, average premium near $65, gross revenue around $4,000, and net just above $1,000 after lead spend and commissions; sales-per-agent hit target only on Friday, raising questions about lead volume, lead quality, agent training, and wait times. The team examined Conversely analytics for objection types and agent performance, noted concerns about anonymized reports, and agreed to dig deeper into Conversely data and implement Jon\u2019s earlier notes to improve morning insight emails and coaching. Jon and Pete",
    "action_items": [
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will implement the notes Jon sent and integrate them into the morning reporting setup either tonight or tomorrow"
      },
      {
        "assignee": "Katy Martinez",
        "task": "Katy Martinez will send Jon's previously shared notes to Peter and confirm they appear in his inbox"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will reply with both the implementation notes and the CSR dashboard to Katy and Peter"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will run training and role-play sessions with the new agents on Tuesday and Wednesday"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will get the download and inform Katy about Bill\u2019s training days and which agents are expected to sell each day"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will add Jon Maso to the Google Drive holding VA performance data"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will spend time parsing and making the VA performance data usable"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will forward the emails and CSR information he referenced to Peter Schmitt"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will locate and send his TalkDesk notes to Peter Schmitt"
      },
      {
        "assignee": "Jon Maso",
        "task": "Jon Maso will evaluate Zoom voice-over-IP as a telephony option and report findings"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do you have T\u2011Mobile for your phone service?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can we do a quick test of the main number to verify the caller prompt and carrier registrations?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is the carrier approval status for the two new agents?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How many days should the new hires expect to be in training and off the phone?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is there a certification process after training?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are you still recording the test?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Would you have done that many tests yesterday on Friday?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Any recruiting activity?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "So TalkDesk isn't browser-based, is that what you're saying?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What about Five9\u2014what's the minimum there?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The main website phone number 855-696-5413 was tested and confirmed to connect with the expected IVR/virtual-agent prompt after carrier registrations"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Friday's results: six deals, 23 billables, CPA $161, average premium ~$65, gross ~$4,000, net just above $1,000"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The sales-per-agent target of 2.5 was met only on Friday and has been rarely achieved, prompting questions about volume, quality, and training"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conversely data shows losing deals after plan details as a primary weakness and highlights differences in agent execution"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Some Conversely reports are anonymized unexpectedly, complicating agent-level coaching"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Two new agents are pending carrier approvals and writing numbers, with no final confirmations yet"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Training for new agents includes role-play and a ten-profile VA trainer plan prepared by Anya, with Jon planning to run Tuesday/Wednesday sessions"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jon observed an update from X likely caused test calls over the weekend"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter granted Jon access to the Google Drive holding VA performance data so Jon could review Friday's activity"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team found many calls were hang-ups or customers seeking free products, and decided agents should handle those for now"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jon prefers tightening first-line filters later rather than blocking calls now to avoid hurting RPC"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Several recruiting leads exist but many lack sufficient state coverage to start without transfers"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Dialed In cannot accept lead data and a routing ping in one step, requiring the state to be set in the system before pinging"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Five9 offers full features but has high upfront costs that the team found prohibitive"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Aircall is favored for its native GoHighLevel integration and workflow triggers"
      }
    ]
  },
  {
    "title": "Daily pipeline updates",
    "date": "2026-04-17",
    "time": "2026-04-17 9:00 AM - 9:30 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Larry Blumenstyk",
      "Tim Collopy",
      "Xiaobing Yang",
      "Peter Schmitt",
      "Katy Martinez",
      "Anya Kiseleva"
    ],
    "summary": "The meeting reviewed technical progress on the virtual agent and operational planning for an imminent phase-one launch. Participants discussed a lightweight neural-network noise suppression fix for Twilio audio, its strong test results, remaining transcription sensitivity issues and rollback limitations, and a proposed same-day production push pending final validation; commercial alternatives such as Krisp were also compared. The team agreed to deploy the improved VA and monitor performance while allowing measurement windows to assess weekend stability. Discussion moved to a large sales opportunity requiring call audio plus agent screen capture for QA; the engagement could begin with 25\u201350 agents and scale to roughly 180 by the end of the summer, and Cindy will provide the business requirements document for integration work. Operational items included troubleshooting quoting rules and a UHC redirect, integrating Convoso call and metadata feeds for agent and lead insights, collecting ca",
    "action_items": [
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will obtain the business requirements documents from Cindy"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will send two proposals, including one for Affinity (formerly listed as Omni), today"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Kevin will complete the SAQD self-certification for Qualphone today"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will forward the final answer to Kevin regarding the outstanding item"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will load the two UHC files into the system and build reporting from that data"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Cody will provide campaign background and details needed to submit follow-up messaging for TextGrid approval"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will produce a written phase-one scope for Peter reflecting the agreed boundaries and follow-ups"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will push the improved VA to production today and notify the team when it goes live"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "John will email Xiaobing the name of the calling platform he is trialing so she can research integration feasibility"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will meet with Katy Martinez on Monday to review outbound calling and lead-generation service flows"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing Yang/the offer team will combine same-day calls by call ID and provide the consolidated data for analysis."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will call Ron in Vegas to explain that CareSource deliverables are blocked until the client provides required information."
      },
      {
        "assignee": "Anya Kiseleva",
        "task": "Anya Kiseleva will follow up with Beverly to request the missing scorecard phrasing for CareSource today."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will call Jay to set expectations about National Media Connection pre-run insight reports and availability of new call types."
      },
      {
        "assignee": "Anya Kiseleva",
        "task": "Anya Kiseleva will put Casey back on the complaint-email thread and email Tim when done."
      },
      {
        "assignee": "Anya Kiseleva",
        "task": "Anya Kiseleva will make herself available to Larry for system questions as he onboard and tests systems."
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will go into SecureFrame and click to accept each individual policy after the meeting."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will send the workbook version of the grid to Anya, Xiaobing, and Larry."
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will send a calendar hold for Tim for the 2:30\u20133:30 slot this afternoon."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Why does the client want screen capture during calls?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are existing QA systems already capturing screen and audio in this way?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Where does the team stand on intents and monitoring to understand virtual-agent behavior?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can Anya add behavioral/intent metrics to the report she sends?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is it clear what functional requirements belong in the minimum viable product?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is the VA push to production happening now?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is the name of the calling platform John is trialing?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can a custom report be created for TrueChoice VA agent behaviors?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are you finding the test calls better after fixes?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team implemented a neural-network noise suppression filter that materially improved virtual-agent audio quality in tests"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The new filter reduces transcription errors but requires sensitivity tuning and may affect barge-in behavior"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing reported limitations for safe rollback and urged caution before broad production release"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The group is considering commercial noise-cancellation tools such as Krisp as an alternative or complement"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The client requires both call audio and agent screen capture at call time, increasing integration scope"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim will attempt to obtain detailed business requirements from Cindy to scope the screen-capture work"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A potential client project could scale to 180 agents by end of summer, beginning with 25\u201350 agents"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Two proposals must be issued today, one for Q Karma/Affinity and another related item listed as Omni"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing is troubleshooting quoting rules and needs to load UHC files to build reporting"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Convoso call and metadata integration is required to enable agent and lead insights for phase one"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Cody expects follow-up messaging and campaign management to be included in phase one MVP, affecting scope"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team will document a definitive phase-one scope to set expectations with Cody and partners"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The improved VA will be pushed to production today and the team will monitor for issues over the weekend"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "TrueChoice is evaluating Quixi for calling and Go-High-Level for texting, which may affect integration plans"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The Assured scorecard changes are complete and showed an immediate improvement in the metric."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Offer team will send call times and conversion flags for QLE calls, so engineering and analysis must be ready to ingest them."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The dev team is implementing logic to combine same-day calls by call ID to better identify system/audio issues."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "CareSource work is blocked until the client grants SFTP access and provides missing scorecard phrasing from Beverly."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "SOC 2 shutdown tracking still requires completion of an Excel with client shutdown dates and audit-period status."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "National Media Connection expects two new call types deployed by end of the week and clarification on pre-run insights use and cost."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Sunshine and TrueChoice require script review and additional virtual-customer profiles before virtual agent deployment."
      }
    ]
  },
  {
    "title": "Next Gen dashboard review",
    "date": "2026-04-16",
    "time": "2026-04-16 10:15 AM - 10:45 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Larry Blumenstyk",
      "Peter Schmitt",
      "Tim Collopy",
      "Xiaobing Yang"
    ],
    "summary": "The meeting reviewed diagnostics from the Next Gen dashboard to investigate recent drops in sales and payments tracking across channels and carriers. Participants clarified that the dashboard's green trend numbers represent variance to goal, and Peter Schmitt said he shifted focus from CPA and RPA to placement rate and only began digging into the issue within the past 48 hours. The group examined a decline in sales attributed to a virtual agent source and debated whether the root cause is upstream lead quality or licensed agent performance, while also reviewing CPA calculation and net revenue accounting that subtracts marketing spend and full accrued agent commission from estimated realized revenue. Discussion moved to carrier statement variability and retention drivers for final-expense policies, with payment method coordination (EFT versus credit card) and timing around Social Security deposits highlighted as important levers. Peter demonstrated an AI analyst proof-of-concept for fun",
    "action_items": [
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will investigate the recent drop in sales from the virtual agent source and determine whether the issue is with the lead source or agent conversions."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will investigate why the \"billable calls\" field is blank and resolve the data/display issue."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will examine the discrepancy between policies sold and payments received to identify causes of the large difference."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will continue integrating the AI analyst into the dashboard to surface agency insights and improve the depth of automated summaries."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will make more test calls and log reproducibility issues with audio and behavior detection"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will forward the 4:00 SMS/QA meeting invite to Larry Blumenstyk"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will document the go-live scope for review with Xiaobing and Cody as soon as he can"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will reach out to Cody to check availability and discuss contract mechanics"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will call Larry Blumenstyk at 11:30 to go over questions and the day's plan"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is there an expected time period where the carrier would approve it?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are the trend numbers next to each value based on the previous day?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do you get a feed from the carriers for status updates?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can carriers control when a payment is drawn (timing coordination with social security deposits)?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is the agenda for the meeting with Cody and what do we want to achieve with him?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter is shifting attention from CPA/RPA to a placement-rate problem and has been investigating it over the past 48 hours."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The dashboard\u2019s colored trend figures represent variance to predefined goals for each metric."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Sales originating from the virtual agent source rose initially but have recently declined significantly, prompting investigation."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "CPA is calculated as lead spend divided by number of sales (billable calls \u00d7 cost per call divided by sales) rather than including agent commissions in the numerator."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Net revenue is estimated by applying a 70% realization factor to advanced revenue, then subtracting marketing spend and accrued agent commission."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Carrier statements are inconsistent in format and timing, which complicates payment tracking."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Final-expense policy lapses are predominantly driven by payment issues, with EFT timing aligned to social security deposits as a best practice to reduce lapses."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team has a proof-of-concept AI analyst that can surface agent- and funnel-level signals but the current OpenAI-based summaries are not deep enough and the demo had reliability problems."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The group agreed call-level analytics should be associated with agent behavior and root-cause analysis to enable targeted scripting or coaching changes"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team must account for top-of-funnel, retention, and lifetime value when optimizing for final-expense products"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Agent behaviors are considered teachable and therefore actionable because average calls are relatively short"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim observed audio variability across test calls and will run additional test calls to log reproducibility and customer patience implications"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Larry was invited to a 4:00 meeting about an SMS QA opportunity and will be forwarded the invite"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing will drive creation of a prioritized, itemized day-one feature list to present to Cody"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim will produce a written go-live scope and avoid committing to items that rely on third-party deliverables without plans"
      }
    ]
  },
  {
    "title": "Daily pipeline updates",
    "date": "2026-04-16",
    "time": "2026-04-16 9:00 AM - 9:30 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Katy Martinez",
      "Larry Blumenstyk",
      "Peter Schmitt",
      "Tim Collopy",
      "Xiaobing Yang"
    ],
    "summary": "The meeting reviewed pipeline updates and prioritized commercial opportunities while clarifying compliance and technical requirements needed to advance deals. Participants focused on a potential strategic partnership with Qualphone tied to an AT&T program and agreed to collect volume and scope from Qualphone before pursuing PCI certification, noting HIPAA has no single certifier and can be represented via Secureframe evidence. The group assigned work to refine the AT&T statement of work, reconcile pricing mechanics against minimums, and validate agent\u2011 and minute\u2011based billing approaches. The discussion then moved to sales prospects and implementation tasks, including Q\u2011Karma, Omni, LXC, HP1, and CareSource\u2019s SFTP dependency pending Ron\u2019s approval, plus Sunshine and Assured metadata work to separate call types for analytics. The team reviewed Solar Optimum agent\u2011insight automation and agreed to include follow\u2011up EC calls in analysis while Xiaobing described updating PolicyGuardian rule",
    "action_items": [
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will reach out to Tim G to see if the Qualphone/AT&T matter has reached his desk."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will request more detail from Qualphone on volume and overall scope before the company considers PCI certification."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will confirm and modify the SOW payment terms to align with the PSA and client expectations."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will text Omni and schedule the demo times offered for today or tomorrow."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will meet with HP1 contacts next week and notify Janine at Insight about potential meetings to obtain additional information."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will follow up with Ron about the CareSource SFTP approval during Ron\u2019s next availability at Medicarians."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will send Peter examples of lead types and Conversely analysis from National Media Connection for the Dino opportunity."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will discuss Dino and the provided materials during his 4\u20135 meeting with Dino."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will update the system to use Cody\u2019s new rule set for Policy Guardian and verify the output format aligns with existing system expectations."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will design and implement ingestion for the two UHC files (book-of-business and commission file) and map triggers for follow-up and retention campaigns."
      },
      {
        "assignee": "Katy Martinez",
        "task": "Katy Martinez will draft a statement of work and standard PSA for end users."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will tell PolicyGuardian the team needs a contract written up and will work to align on scope and a go\u2011live date."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will send a separate invite for the dashboard/pipeline call at 10:15."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will retest the system using his test methodology and report results."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will retest the build with the newly added noise suppression algorithm and report the outcomes."
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will arrange for Larry Blumenstyk to perform additional test calls later."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are we HIPAA certified and how should we represent HIPAA compliance to Qualphone?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is Qualphone asking us to pursue PCI certification and/or EIPA certification, and does it make sense for us to do that?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What does \u201cgo live\u201d next Friday mean for Policy Guardian\u2014release to agents or internal release\u2014and what stands in the way?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What contract do we currently have with PolicyGuardian?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Should features that won\u2019t be ready on day one be mentioned and priced in the initial version?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The Qualphone/AT&T opportunity is being treated as a potential strategic partnership and requires clearer volume and scope before considering PCI certification."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The company is HIPAA compliant but not \u201cHIPAA certified\u201d; Secureframe provides training evidence that allows checking the HIPAA box for prospects."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team will not pursue PCI certification proactively and will only consider it if the Qualphone opportunity\u2019s scale justifies the cost."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Contracting is in progress: a PSA exists and an SOW requires more detail, including possible changes to payment terms and minimums."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Pricing mechanics will be upfront-billed against a minimum and reconciled later, with agent-based pricing defined as unique agents logging in during the month."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Several small-to-medium prospects (Q-Karma, Omni, Medicarians) are progressing toward demos and introductory meetings."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Sunshine and Assured require metadata work on the client side to separate ACA, recruitment, and retention calls before richer analytics can be delivered."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Solar Optimum needs automated agent-insight delivery and inclusion of follow-up EC calls in analysis rather than only initial appointment calls."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Policy Guardian requires updating the system to use a new, more accurate set of rules from Cody and to ingest two UHC files to drive reporting and follow-up campaigns."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team set an informal target to have a minimal release of Policy Guardian capabilities by next Friday, pending clarification of what \u201cgo live\u201d entails."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team must finalize pricing and a user-facing contract before launch."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "There are two contract streams: a PolicyGuardian LOI/partnership track and separate PSAs/SOWs for end users."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The PolicyGuardian partnership does not have a finalized contract and likely will take longer than one week to complete."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "CRM functionality is out of scope for the immediate go\u2011live and must be scheduled as a later phase."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The initial go\u2011live scope must be documented and priced so PolicyGuardian and end users are aligned."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Validify (third\u2011party) costs must be captured as an additive line item in initial pricing and accounted for in month\u2011end true\u2011ups."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The company decided on a $2,500 monthly minimum per individual agency."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A follow-up technical testing plan was agreed: benchmark against Blender AI and compare new build to production before release."
      }
    ]
  },
  {
    "title": "Finance Weekly Operations Review",
    "date": "2026-04-15",
    "time": "2026-04-15 2:00 PM - 3:00 PM (EDT)",
    "platform": "Teams",
    "participants": [
      "Peter Schmitt",
      "Mike Hecker",
      "Katy Martinez"
    ],
    "summary": "The meeting reviewed finance and operations with a focus on March cash impacts, predictive modeling, and Conversely results. Attendees highlighted gaps in preparation and attendance and prioritized understanding cash effects tied to agency payments and commission timing. The team identified that SICA/SECA policies sold by credit card are paid on an as\u2011earned basis and that this pattern affects about 25% of cash flow and agent commission timing. Participants agreed to validate commission schedules and cash receipts by digging into carrier statements and reconciliations and to institute a short daily huddle to review incoming items and agency profitability. Forecasting and budget impacts were reviewed next, covering payroll, rent, and SG&A variances; the predictive model would require approximately $900,000 in cash before balance sheet items are included. The group reviewed outstanding receivables and flagged several large accounts\u2014Phalanx (~$36\u201343k), Shore Prime, and Solar Optimum\u2014for p",
    "action_items": [
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will follow up on the SICA question this week."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will dig into carrier statements and cash reconciliation the rest of this week."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will meet with Peter (proposed tomorrow or Friday) to discuss agency cash and concerns in more detail."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Jackie will follow up with Celine regarding the $5,000 security deposit."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter will confirm and send the information Jackie needs for Sarah (confirmation on timing)."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will send the detailed slide and supporting material after the meeting."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will perform the planned bad\u2011debt write\u2011off in April."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will take Shore Prime out of the receivables list pending write\u2011off."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter will ask to turn off Navar and Phalanx today."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will contact Phalanx to follow up on the unpaid $42,000 balance."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will update the income statement to reflect the two headcount reductions."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Should we look at 2027 to ensure we save enough to pay for losses in 2027?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What funding is needed for Conversely right now?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Did Tim provide a verbal update after his meeting with Navar/Ariel?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is the forecast covering this month in April?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can you go back to the income statement for a minute to check reflected changes?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The meeting focused on reviewing predictive and Conversely March results."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The group plans daily huddles to monitor incoming items and improve agency profitability visibility."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team must address agency cash impacts caused by SICA/SECA policies paid by credit card being recognized on an as\u2011earned basis."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "As\u2011earned payment treatment for card sales can reduce cash flow by about 25% and affects agent commission timing."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Carrier statements are the primary backup used to prepare commission invoices and reconcile cash receipts."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Predictive is projected to require roughly $900,000 of cash before considering balance sheet receivables and payables."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A bad\u2011debt write\u2011off for outstanding accounts was scheduled to occur in April."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conversely has several receivables at risk and potential write\u2011offs, notably Phalanx (~$36\u201343k) and Shore Prime."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team paused processing minutes for at least one client after a margin invoice of just under $10,000 was identified."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Multiple participants expressed low confidence in collecting outstanding balances from key clients, including Phalanx and Navar."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The cash-basis April forecast excludes receipts from Reviva and Phalanx and assumes near-term deterioration if those receipts do not materialize."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Specific likely write-offs discussed include $42,000 from Phalanx and $20,000 from Navar, contributing to an estimated ~$80k\u2013$100k of bad debt exposure."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Participants weighed keeping systems live (incurring AWS charges) to support demos versus shutting systems to stop ongoing costs."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The group removed roughly $100,000 from the revenue forecast and added layering and payroll expense impacts to the projection."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The income statement does not yet reflect a planned reduction of two headcounts, which attendees noted will have minimal impact but needs updating."
      }
    ]
  },
  {
    "title": "Ethan <> Conversely re-connect",
    "date": "2026-04-15",
    "time": "2026-04-15 9:30 AM - 10:00 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Collin",
      "Ethan Ring",
      "Peter Schmitt",
      "TJ",
      "Tim Collopy"
    ],
    "summary": "The meeting opened with a proposal to create a scoped role for a dedicated onboarding specialist and to launch an integrated outbound sales development program. The proposed onboarding role would own post-sale activation, personalized product tours, data migration, core-feature training, and serve as the primary post-sale contact, with the vendor offering to staff the role temporarily until the customer hires in-house; TJ volunteered and described relevant experience at Google Partners and Dell, and participants reacted positively to his fit for the role and potential to support outbound sales as needed. Discussion then moved to platform constraints that currently limit self-service onboarding and the need for the specialist to handle new-client activations and existing-client changes while documenting processes to enable future self-service. The group reviewed a three-channel outbound approach\u2014LinkedIn for awareness, high-volume personalized email for reach, and cold calling for conve",
    "action_items": [
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will assign a dedicated onboarding specialist to own the post-sale activation for the initial months until an in-house hire is ready."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "TJ will serve as the onboarding/customer-success specialist if engaged by the team."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will add Peter\u2019s, Tim\u2019s, and the AE\u2019s LinkedIn accounts to an automation platform for outbound outreach."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will set up automated email and LinkedIn workflows and segmented prospect lists within a few days to start high-volume outreach."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will build a coordinated multi-channel sequence that includes LinkedIn, email, and cold calling to reach the same contacts across channels."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will implement engagement tracking that creates Slack tickets to tag salespeople for immediate follow-up when prospects interact with content."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will send a concise proposal that includes the finalized scope of work by end of day or tomorrow morning."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will schedule a separate one\u2011hour follow\u2011up meeting to align on target verticals."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How did you want to price the onboarding/customer-success role?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How will new names be added into the top of the funnel by industry segment?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do you integrate with HubSpot today?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What are the next steps if we are aligned\u2014will you send a proposal?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A dedicated onboarding specialist role was proposed to own post-sale activation, personalized tours, data migration, training, and be the primary post-sale contact."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The vendor offered to staff the onboarding specialist for the initial months until the client can hire in-house."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "TJ volunteered for the onboarding/customer-success role and highlighted prior experience at Google Partners and Dell that aligns with the responsibilities."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The platform\u2019s current architecture is not fully self-service and will require the onboarding specialist to perform configuration and validation work for new and existing clients."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The outbound plan will use LinkedIn for awareness but not as the primary meetings channel."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The vendor will run high-volume personalized email sequences segmented by vertical and persona to drive top-of-funnel reach."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Cold calling is expected to produce the majority of qualified meetings and will be coordinated with email and LinkedIn touches."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Engagement tracking will create Slack tickets tagging salespeople for immediate follow-up when prospects interact with content."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The vendor can integrate with the customer's current tech stack and HubSpot rather than forcing a platform change."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The vendor will review and incrementally improve the customer's existing HubSpot setup instead of rebuilding it."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The vendor proposed mid\u2011funnel automations such as marking deals stale and auto\u2011creating sales follow\u2011up tasks."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "HubSpot alone limits personalization and multi\u2011domain email sequences, so the vendor recommends adding at least two or three additional tools integrated into workflows."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team identified mortgage/lending, home services, hospitality, telecom, universities, debt collection, healthcare, and insurance as priority verticals to test campaigns."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim emphasized insurance as a primary success story and questioned the volume potential of single auto dealerships."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The vendor committed to send a concise proposal with an attached scope of work by end of day or tomorrow morning."
      }
    ]
  },
  {
    "title": "Daily pipeline updates",
    "date": "2026-04-15",
    "time": "2026-04-15 9:00 AM - 9:30 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Larry Blumenstyk",
      "Tim Collopy",
      "Xiaobing Yang",
      "Peter Schmitt",
      "Katy Martinez"
    ],
    "summary": "The meeting focused on daily pipeline updates, scheduled calls, and product work that directly impacts revenue. Participants reviewed upcoming client meetings and demos for CareSource, Qualphone, Omni, Q Karma, and others, and agreed to prioritize turning active opportunities into measurable invoices and onboarding steps. Tim outlined a goal to set CareSource up and issue a first invoice even though the account had not been forecasted until May. Tim and Peter also planned onboarding Qualphone into the Conversely B2B sales program and additional follow-ups with Alliant and other leads to quantify opportunity size. The group examined repeatability and scaling of the marketing automation product, concluding that integration, data flow, and campaign business rules are the primary scaling efforts rather than custom UI work. The team addressed National Media Connection\u2019s request to add call types, recognized the revenue potential, and identified IT/dev changes as a bottleneck while asking La",
    "action_items": [
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will become familiar with the pipeline board and be onboarded over the next couple of days"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will attempt to schedule another meeting with CareSource to collect the remaining information needed to create scorecards"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will set up CareSource for implementation and issue the first invoice for program design"
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will attend the Qualphone meeting that Tim placed on his calendar"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will schedule a call with Cindy at Alliant to clarify the size and scope of that arm\u2019s opportunity"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will reach out to TestGrid (or coordinate outreach) to resolve the TechSquid approval/data update issues"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "X (meeting participant referenced as X) will prioritize adding the additional call types for National Media Connection in the system"
      },
      {
        "assignee": "Larry Blumenstyk",
        "task": "Larry Blumenstyk will investigate how to enable account teams or customers to self-service adding call types and report what is needed to remove IT/dev as the bottleneck"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter Schmitt will create live access for team members to perform testing"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will perform testing of the system and continue providing feedback on AI call behavior"
      },
      {
        "assignee": "Katy Martinez",
        "task": "Katy Martinez will populate the shared test spreadsheet with test outputs and send it to everyone"
      },
      {
        "assignee": "Tim Collopy",
        "task": "Tim Collopy will call Will today to discuss account coordination"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "What is our process to replicate deployments for other organizations and how much elbow grease and timing is required?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is Cody adding scope or changing requirements as he tests the quoting tool?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is the work on underwriting rules going to be never-ending and blocking CRM/messaging work?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Who will take responsibility for running tests going forward?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The meeting\u2019s primary purpose is to align daily work on product improvements and revenue generation."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim aims to set CareSource up and send the first invoice for program design even though they are not in the forecast until May."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Qualphone is being evaluated as a channel for Conversely in AT&T B2B sales and a meeting with them is scheduled for today."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Alliant (via Jennifer) may represent a sizable opportunity within their second-largest arm; a call with Cindy is being scheduled to clarify scope."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The marketing automation product is largely rinse-and-repeat from a user settings perspective, reducing the need for custom builds for each client."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Integration, data flow, campaign business rules, and message cadence are the areas that will consume time when deploying to new clients."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "National Media Connection wants additional call types added because the analytics produced clear value, driving demand to expand usage."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The current process requires IT/dev involvement to add new call types, creating a bottleneck that prevents scale; making this self-service was requested for investigation."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "There is a cost/design trade-off if clients self-serve heavily due to per-minute pricing and potentially high volumes."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Cody\u2019s underwriting rules were generated by AI parsing hundreds of UHC plan PDFs, not from published insurer rules, and they remain evolutionary as Cody refines them through testing"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The Convoso APIs can provide recording download URLs, but integrating Convoso dashboards is a lower-priority, downstream task"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The immediate technical priority is stabilizing the coding engine and fixing AI misinterpretation of background audio rather than pursuing integrations"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team agreed to adopt a faster, variable-driven testing approach and avoid lengthy waterfall analysis of each test batch"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter will provide live access for more people to perform testing to accelerate issue discovery"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Tim committed to performing testing and to call Will to clarify account coordination"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Katy will document test runs in a shared spreadsheet and distribute it to the team"
      }
    ]
  },
  {
    "title": "Daily pipeline updates",
    "date": "2026-04-14",
    "time": "2026-04-14 9:00 AM - 9:30 AM (EDT)",
    "platform": "Teams",
    "participants": [
      "Tim Collopy",
      "Xiaobing Yang",
      "Katy Martinez",
      "Peter Schmitt"
    ],
    "summary": "The meeting reviewed active pipeline items, scheduling for follow-up calls with Katy and Peter, and confirmations about a National Media Connection call, then moved into immediate priorities including PolicyGuardian pending Peter\u2019s arrival, Qualphone PCI self-attestation with an imminent integration/SOW meeting, and Sunshine data/dashboard fixes that require call-type filtering or a new dashboard filter and client documentation. The group discussed implementation and resourcing needs such as CareSource SFTP access for test files, Larry\u2019s onboarding and a client-review deliverable, and several sales risks and opportunities including a paused National Media Connection over security concerns, hospitality demo requests, Citizens and CareValue prospects, and an employee-benefits QA request that may require screen recording and ServiceNow details. Attention shifted to Convoso integration and PolicyGuardian testing, where attendees clarified Convoso\u2019s API will supply lead metadata for phase o",
    "action_items": [
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will forward the integration invite email to Bernard and others who did not receive it"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will write up the required call-tab naming/documentation as offered on the call"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will write up the documentation for separate call tabs for Sunshine and send it to X"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Anya will grant Larry access to the demo site and all client environments and system invites"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will ask Larry today whether he has already notified Will about his hire"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will meet with National Media Connection at 1:00 to address their security/compliance concerns"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will follow up daily with HP1 to maintain engagement and track their decision"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Kevin will complete the Qualphone PCI self-attestation starting today"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will schedule and host the Qualphone data-integration meeting tomorrow and include Larry"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter will join the Convoso call today to understand available integration options"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter will demonstrate the TrueChoice dashboard to X and Tim so they can evaluate its fit for the new product"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will meet with Anya immediately after the meeting to coordinate retesting steps and verify echo behavior"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will have Larry run speakerphone and other device scenario tests and complete the shared spreadsheet with results"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "X (Xiaobing Yang) will review the new test results, tweak variables, and make necessary code changes based on those results"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Larry will start the work referred to by the conference room participants tomorrow."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The meeting participant (conference room) will follow up with Axel on next steps for the testing."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter will investigate why Channel Edge Digital Media produced a sale with no billable calls and dig into that discrepancy."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will integrate the voice-agent data into the dashboard to enable agent-performance analytics."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will check whether the carrier statuses were updated as referenced in Bill's Saturday email."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will contact Peter this afternoon to understand his plans for using Conversely/SOAPI and to clarify what to show him. (01:04:53)"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will decide with the team what parts of the prototype to present to Peter after gathering his feedback. (01:05:20)"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will exclude test calls/campaigns from the VA data source to correct transfer-rate and sales-linkage metrics. (01:12:41)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Can the dashboard filter out recruiting and retention campaigns to prevent the overall score from dropping?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are Peter and Katy planning to be in Las Vegas next week?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do the client leads already have screen recordings available or would we need to record screens to provide that to the client?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Does the Convoso API provide real-time voice streaming?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Will we be able to implement a web version of the dashboard/integration?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Where does the dashboard data come from and how is it assembled?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How did you get to the agent view in the dashboard (what navigation opened that tab)?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are the new statuses shown coming from the carrier?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Who will own the CRM system once it is built? (01:03:12)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Has Peter seen the work completed over the weekend? (01:05:35)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "How are you linking sales to VA transfers given mismatched IDs? (01:12:12)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Scheduling conflicts and invites need resolution for Katy/Peter follow-ups and the National Media Connection call."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Policy Guardian discussion will wait for Peter to join the call."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Sunshine requires dashboard filtering for recruiting/retention to avoid lowering overall scores."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team must prepare and send documentation to Sunshine/clients to separate call types in the API integration."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "CareSource SFTP access for test files is outstanding but an implementation meeting occurred."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Larry starts tomorrow and requires system access and onboarding materials to review client environments."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "National Media Connection paused one small call type over security/compliance concerns, representing ~6% of volume."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Hospitality demo requests were identified as a priority for a targeted demo to enable reseller conversations."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Qualphone needs completion of PCI self-attestation before the integration/SOW can be finalized."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A potential employee-benefits QA opportunity may require screen-recording support and ServiceNow integration evaluation."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Real-time voice streaming is being deferred to phase two while phase one focuses on metadata, CRM, and quoting."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Convoso\u2019s API will provide lead metadata for phase one, not real-time voice streaming."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team must decide whether Peter\u2019s TrueChoice-style dashboard becomes the primary CRM dashboard in the new product."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Peter\u2019s dashboard demonstrates operational value but is currently local and encountering an API error when pushed to the web."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Previous PolicyGuardian test calls contained echoes, so prior results may be unreliable and require retesting from a clean baseline."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team assigned planned speakerphone testing to Larry using a spreadsheet of scenarios to validate echo behavior."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "X will re-run tests from the beginning, analyze results, and then adjust variables or code rather than testing arbitrary combinations."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The dashboard includes a \"daily brief\" feature that summarizes key daily metrics like apps submitted, calls, billable rate, and net revenue."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "There are current data mismatches and bugs affecting RPC and agent-performance displays."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The dashboard's data ingestion is automated nightly from multiple sources."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The system is combining Conversely email content to produce lead-quality and funnel analyses."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Reconciliation shows a large gap between written commissions and paid amounts ($112,000 written; $37,000 paid)."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The dashboard already pulls three distinct data sources: CRM/job-form, dialer data, and carrier reports."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The current architecture is not suitable to scale and prototype files from virtual agents are required to move forward. (01:01:36)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team needs to present Peter\u2019s and Katy\u2019s overlapping work carefully and clarify authorship and intent when showing it to external stakeholders. (01:02:08)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The CRM was defined as the data store that manages application and status workflows, while the quoting engine is the agent-facing UI. (01:03:34)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing will contact Peter this afternoon to confirm his plans for using Conversely/SOAPI before the team finalizes what to show him. (01:04:53)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Phase one pricing was proposed at $90 per agent per month covering Conversely analysis, quoting, and CRM, with added fees for drip campaign usage. (01:07:01)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The group acknowledged the agent insights feature is new and should be integrated because it is highly valuable and easy to use for True Choice coverage. (01:08:21)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The VA data linkage is inconsistent; the team plans to use phone numbers to match sales and exclude test calls from the source data. (01:12:20)"
      }
    ]
  },
  {
    "title": "Daily pipeline updates",
    "date": "2026-04-13",
    "time": "2026-04-13 3:00 PM - 4:00 PM (EDT)",
    "platform": "Teams",
    "participants": [
      "Mike Hecker",
      "Tim Collopy",
      "Xiaobing Yang",
      "Katy Martinez"
    ],
    "summary": "The meeting opened with a review of month-to-date pipeline and client performance focusing on volume and forecast alignment. Participants highlighted uncertainty in Cresso file delivery and discussed a conservative projection of 12.5k minutes versus a 6.25k forecast adjustment after noting 222,000 minutes with unclear future files. The group also examined SMS volume concentration on weekdays and confirmed current data reflects eight Monday\u2013Friday days with 14 business days remaining in the month. Solar Optimum\u2019s pilot of deeper agent-level analysis received positive feedback, and Michael requested a one-day agent-level validation with expanded follow-up-call analysis before committing to the feature. National Media Connection reported a temporary cease-and-desist affecting Audion call recordings representing roughly six percent of volume while other campaigns remain active and client discussions are being rescheduled. The conversation moved to onboarding, environment cleanup, and colle",
    "action_items": [
      {
        "assignee": "Peter Schmitt",
        "task": "Meeting participants will monitor National Media Connection\u2019s situation and re-forecast the $3,000 item beyond April if the restriction of Audion calls sustains"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will finalize Larry\u2019s offer letter and variable compensation details with Katy, Peter, and Mike by the end of this week"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will talk to Alyse tomorrow to define her level of involvement, hours, and start date"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Brett will take over the texting scope for Conversant (conversing)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Conference room participant will meet with Brett at 10:30 tomorrow to give him a walkthrough of TextGrid and Twilio access"
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will call the external contact every two days to resolve payment/status and report back."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will double-check the deletion list and remove remaining inactive deployments such as Reviva and ShuraPrime."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The conference room participant (collections lead) will call Ariel again and attempt contact in Las Vegas next week, and will look up the alternate name Ariel previously provided."
      },
      {
        "assignee": "Mike Hecker",
        "task": "Mike Hecker will issue credit memos to write off unrecoverable invoices (including Solar Optimum and other small balances) and clear them from the AR list."
      },
      {
        "assignee": "Xiaobing Yang",
        "task": "Xiaobing Yang will meet with Cody the next day to confirm which Convoso API data are required and how to ingest it for the CRM/dashboard."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will grant Xiaobing Yang access to the True Choice/Policy dashboard so he can review its structure and integrations."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The conference room participant coordinating integrations will ensure Peter is on the Convoso/dashboard call with Cody to align dashboard expectations and technical details."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will address the NDA redlines returned by Validify."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Katy will coordinate with Kevin to determine whether he can complete the vendor PCI self-attestation items before his international travel."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will follow up with CareSource to obtain SFTP access and confirm the required file format for call ingestion."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Larry will perform targeted testing or follow-up on vendor instructions if no response is received after sending access/configuration instructions."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Anya will stop broad batch testing until device-related echoes are resolved and will perform one or two test calls using headphones or without speakerphone for review. (01:02:56)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will schedule a call with Rodolfo\u2019s IT team to confirm how retention and recruitment calls are sent and parsed. (01:04:29)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "A conference room participant will configure the non-sales scorecard in the system so non-sales calls appear in the dashboard and enable historical updates. (01:04:43)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is 13% the correct interpretation of Sunshine\u2019s received monthly minutes so far?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Are they still open to us processing other clients\u2019 calls and just not sharing analysis with that specific buyer?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "For the other 94% of National Media Connection volume, are we still processing their calls?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Do we know whether the buyer received similar feedback for other call types and whether that feedback was received positively?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "X, have you gotten a chance to think through whether we should move the code and shut the environment?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is there a way to archive the environment instead of deleting it?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Should we call the client today or tomorrow and continue calling every two days until resolved?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "X, what's your plan for PolicyGuardian work and updates?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Should Peter be on the Convoso/dashboard integration call with Cody?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "When is Kevin going out of town?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Did we name Qualphone in the forecast yet?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Is Anya getting echoes on all of her test calls?"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team warned against prorating Cresso minutes because future file delivery is uncertain, despite 222,000 minutes already received."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "SMS and most program volumes are concentrated on weekdays, and current numbers reflect only eight business days with 14 weekdays remaining this month."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Solar Optimum\u2019s deeper agent analysis impressed Michael, who requested a one-day validation on select agents before broader adoption."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "National Media Connection received a cease-and-desist from a buyer over call analysis, affecting a small portion of volume but not other campaigns."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team will monitor National Media Connection\u2019s situation and re-forecast the $3,000 item beyond April if the restriction persists."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Larry\u2019s start on Wednesday includes a compensation structure that the team agreed to finalize by the end of the week."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Alyse expressed interest and will be evaluated for involvement; the speaker will define her role and timing this week."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Brett will take over the texting scope and will receive a walkthrough at 10:30 tomorrow."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team must decide whether to delete a working-but-unused environment and acknowledged there is no easy archive option."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Insure It All is approximately $30,000 past due and the team will continue collection efforts while preserving system evidence for potential disputes."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The group agreed to change future client contracts to require an upfront minimum payment rather than 30\u201360 day terms."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Several accounts (Navar, Century Benefits, Landmarks, Health) are significantly overdue and will be pursued by phone and invoice follow-up."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Accounting will issue credit memos to write off clearly uncollectible invoices like Solar Optimum and other small balances."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "PolicyGuardian phase one will include Conversely insights, the quoting tool, and the CRM with texting functionality at a bundled $90/month price point with a $500 messaging minimum."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Xiaobing has completed AutoCard and Android pre-existing-condition rules and has pushed updates to production based on UHC feedback."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team received an NDA with redlines and committed to addressing them promptly."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Katy signed a mutual NDA with Citizens Insurance; no work has yet been performed for that prospect."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "Qualphone implementation and PCI self-attestation are priority items tied to revenue and require coordinated IT work and documentation."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The team should engage Kevin immediately to determine his capacity to complete vendor PCI self-attestation before his international travel."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "CareSource onboarding depends on SFTP access and a confirmed file format before call ingestion can begin."
      },
      {
        "assignee": "Peter Schmitt",
        "task": "True Choice virtual agent test results are unreliable due to echo and device issues during Anya\u2019s tests and require re-testing under controlled conditions. (01:00:07)"
      },
      {
        "assignee": "Peter Schmitt",
        "task": "The non-sales scorecard has been created and must be configured so non-sales calls appear on the dashboard and historical data can be updated. (01:03:58)"
      }
    ]
  }
];

export async function GET(request: NextRequest) {
  // Gate behind a shared secret. Set SEED_TOKEN in env, then call:
  //   GET /api/seed?token=...   or   Authorization: Bearer <token>
  const expected = process.env.SEED_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'Seeding disabled — set SEED_TOKEN in environment to enable.' },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const provided =
    url.searchParams.get('token') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check if already seeded
    const existingMeetings = await db.select().from(meetings).limit(1);
    if (existingMeetings.length > 0) {
      return NextResponse.json({ message: 'Already seeded', count: existingMeetings.length });
    }

    // Insert companies
    const companyMap: Record<string, string> = {};
    const companyData = [
      { name: 'Conversely AI', type: 'Portfolio' },
      { name: 'True Choice Communications', type: 'Portfolio' },
      { name: 'Pine Lake Capital', type: 'Portfolio' },
    ];
    for (const c of companyData) {
      const [inserted] = await db.insert(companies).values(c).returning();
      companyMap[c.name.toLowerCase()] = inserted.id;
    }

    function inferCompany(title: string): string | null {
      const tl = title.toLowerCase();
      if (tl.includes('conversely')) return companyMap['conversely ai'];
      if (tl.includes('true choice')) return companyMap['true choice communications'];
      return companyMap['pine lake capital'];
    }

    // Collect unique participants
    const allPeople = new Set<string>();
    for (const m of SEED_DATA) {
      for (const p of (m.participants || [])) {
        if (p) allPeople.add(p);
      }
    }

    const contactMap: Record<string, string> = {};
    for (const person of Array.from(allPeople).sort()) {
      const [inserted] = await db.insert(contacts).values({ fullName: person }).returning();
      contactMap[person] = inserted.id;
    }

    // Insert meetings + action items
    let meetingCount = 0;
    let actionCount = 0;
    for (const m of SEED_DATA) {
      if (!m.date) continue;
      const [insertedMeeting] = await db.insert(meetings).values({
        title: m.title,
        meetingDate: new Date(m.date + 'T09:00:00'),
        participants: m.participants || [],
        aiSummary: m.summary || null,
        source: 'gdrive',
        companyId: inferCompany(m.title),
      }).returning();
      meetingCount++;

      const actions = (m.action_items || []).slice(0, 15);
      for (const ai of actions) {
        await db.insert(actionItems).values({
          title: ai.task.substring(0, 250),
          assignee: ai.assignee,
          status: 'open',
          priority: 'medium',
          meetingId: insertedMeeting.id,
          contactId: contactMap[ai.assignee] || null,
        });
        actionCount++;
      }
    }

    return NextResponse.json({
      success: true,
      companies: companyData.length,
      contacts: allPeople.size,
      meetings: meetingCount,
      actionItems: actionCount,
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
