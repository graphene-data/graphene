# Change Management Policy 

## Purpose 

The purpose of this policy is to establish management direction and high-level objectives for the change management process. This policy guides the implementation of changes to reduce the impact on other tasks/projects as well as to mitigate associated risks such as: 

 Information being corrupted and/or destroyed Adverse impact on other organizational processes Computer performance being disrupted and/or degraded Productivity losses being incurred 

## Scope 

This policy applies to all IT systems and applications managed by Graphene’s that store, process or transmit information, including network and computer hardware, software and applications, mobile devices, and telecommunication systems. In addition, it applies to all business units that operate within the organization’s network environment or utilizes its information resources. 

## Policy 

Changes to information resources shall be managed and executed according to a formal change control process. The change control process will ensure that the proposed changes are reviewed, authorized, tested, implemented, and released in a controlled manner, and that the status of each proposed change is monitored. In order to fulfill this policy, the following statements shall be adhered to: 

 A current baseline configuration of the information systems and its components shall be developed, documented and maintained. The baseline configuration of the information systems shall be updated as an integral part of the information system component installation. Changes to the information system shall be authorized, documented, and controlled by the use of formal change control procedures. Changes in the configuration of the information systems shall be monitored. Automatic tools shall be employed (wherever possible) to initiate changes/change requests, to notify the appropriate approval authority, and to record the approval and implementation details. Changes to application and system infrastructure are developed and tested in a separate development or test environment before implementation. Changes that can’t follow the regular process because of their urgency (such as service outage) shall be considered as emergency changes and require immediate priority. Changes that are a normal administrative function or process within a system can be classified as standard changes. Changes affecting customers in a significant manner shall be formally communicated to them prior to change implementation. 

## Change Approval and Implementation 

Developers do not make changes to application code in the production environment without additional approval. Code repository branch rules have been configured to ensure that every merge request to the production environment requires additional approval. Changes shall be approved formally prior to commencing the change or development, and prior to implementing the fully tested change into the live environment. Source code changes are logged, time-stamped, and attributed to their author in a source code management tool. Access to the source code tool is restricted to authorized users using multi-factor authentication. All changes shall be formally assigned to the designated representative for authorization who can approve or disapprove the change depending upon the impact on business services. 


# Kevin Marr 

 Primary Signatory 

# Grant Marvin 

 Secondary Signatory 

**Approved On: 01/09/2026** 

**Version: 1** 

## Communication of Change 

A communication procedure is maintained that describes how employees and customers are notified of a potential application outage, planned or unplanned downtime, changes to application and its functionality, security events and major releases. Internal and external system users are notified through email or internal communication tool for releases prior to system changes which will affect job responsibilities and commitments to the customers. 

## Post-Implementation Review 

Once a change has been implemented, it is important that the situation is reviewed to identify any problems that could be prevented in the future or improvements that could be made. Meetings shall be scheduled on a periodic basis to discuss high and medium impact changes and their status (“successful” or “unsuccessful”). Post-implementation reviews shall be performed to evaluate whether the desired result has been achieved. In the event a change does not perform as expected or causes issues to one or more areas of the production environment, the attendees of the change meeting will determine if the change should be removed and the production environment returned to its prior stable state. 

## Denials 

The business owner/change advisory board or their designee may deny a scheduled or unscheduled change for unreasonable changes like inadequate change planning or unit testing, lack of stakeholder acceptance (where applicable), system integration, interoperability concerns, missing or deficient roll-back plans, security implications and risks, timing of the change negatively impacting key business processes, timeframes not aligning with resource scheduling (e.g. late-night, weekends, holidays, etc. 

## Emergency Changes 

Changes that can not follow the regular process because of their urgency (such as service outage) shall be considered as emergency changes and require immediate attention and need to be implemented quickly in order to avoid disruption. Approvals shall be obtained for such changes in the form of discussing the matter with a relevant service manager. Such changes shall be assessed and formally approved retrospectively. In addition, such changes shall be discussed in periodic meetings for analysis on lessons learned, root cause, impact, and status. 

## Standard Changes and Patching 

Standard changes (also called “routine changes”) tend to be pre-authorized changes that are considered to have little to no risk associated with them. These changes are already pre-approved by IT/Engineering Management so they can be executed by creating a ticket but without following the change management approval workflow (for example, applying security patches). All systems shall be patched and updated on a documented, regular, and timely schedule. Common Vulnerability Scoring System (CVSS) is recommended to be used to aid in setting patching guidelines. Applicable critical vendor-supplied security patches shall be applied within a defined timeframe after release and shall include installation of all other applicable vendor-supplied security patches as per the defined patching schedule. In addition to the patching guidelines, vulnerabilities and exploitable findings deemed critical by Graphene, regardless of CVSS score, must be patched as soon as possible. 


