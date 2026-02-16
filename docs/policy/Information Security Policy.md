# Information Security Policy 

## Purpose and Scope 

This Information Security Policy addresses the information security policy topics and requirements which maintain the security, confidentiality, integrity, and availability of Graphene (hereinafter referred to as "Graphene") applications, systems, infrastructure, and data. The topics and requirements called out in this policy should be continuously improved upon to maintain a secure information security posture. From time to time, Graphene may update this policy and implement different levels of security controls for different information assets, based on risk and other considerations. This policy is guided by security requirements specific to Graphene including compliance with applicable laws and regulations. This policy applies to all Company assets utilized by personnel acting on behalf of Graphene or accessing its applications, infrastructure, systems or data. All personnel are required to read, accept and follow all Company policies and plans upon starting and at least annually. 

## Information Security Communication 

The organization utilizes third-party software to manage its policies and procedures for information security, business code of conduct and operating practices. The policies and procedure documents are reviewed and approved by management annually or during significant changes. Please contact security@graphenedata.com if you have any questions about Graphene information security program. 

## Access to Policies and Procedures 

Internal security, privacy and confidentiality policies and procedures documents are maintained and accessible to employees with read-only permissions. Changes to these policies require prior approval from the appropriate level of management. The Chief Technology Officer (CTO), Chief Operating Officer (COO), or Board of Directors have the authority to modify, remove, or approve modifications to these policies and procedures. Records of all such changes must be kept and reviewed by the Board. 

## People Security 

### Background Check 

All Company new employees and contractors are required to complete a background check/reference check prior to joining. An authorized member of Graphene must review each background check in accordance with local laws. 

### Confidentiality 

Prior to accessing sensitive information, personnel are required to sign an industry-standard confidentiality agreement protecting Graphene confidential information. 

### Secure Coding 

Graphene promotes the understanding of secure coding to its engineers in order to improve the security and robustness of Company products. Security awareness and training must encompass general security awareness, rolespecific security requirements, and ongoing education about emerging threats. The effectiveness of these programs must be regularly assessed and documented. 

## Physical Security 

### Clear Desk 


Company personnel are required to ensure that all sensitive information in hardcopy or electronic form is secure in their work area when it is unattended. This requirement extends to both remote and in-office work. Company personnel must remove hardcopies of sensitive information from desks and lock the information in a drawer when desks are unoccupied and at the end of the work day. Keys used to access sensitive information must not be left at an unattended desk. 

### Clear Screen 

Company employees and contractors must be aware of their surroundings at all times and ensure that no unauthorized individuals have access to see or hear sensitive information. All mobile and desktop devices must be locked when unoccupied. Session time-outs and lockouts are enforced through technical controls for all systems containing covered information. All devices containing sensitive information, including mobile devices, shall be configured to automatically lock after a period of inactivity (e.g. screen saver). 

### Remote Work 

Any Company issued devices used to access company applications, systems, infrastructure, or data must be used only by the authorized employee or contractor of such device. Employees or contractors accessing Graphene network or other cloud-based networks or tools are required to use HTTPS/TLS 1.2+ at a minimum to protect data-in-transit. If you are in a public space, ensure your sight lines are blocked and do not have customer conversations or other confidential conversations. If someone is close to you, assume they can see and hear everything. Connecting directly to a public wireless network that doesn't employ, at minimum, WPA-2 or an equivalent wireless protocol is prohibited. While working at home, employees and applicable contractors should be mindful when visitors (e.g. maintenance personnel) are at their residences, as visitors could become privy to sensitive information left up on computer screens. 

## Infrastructure Security 

All production systems should be hosted on a cloud environment which is equipped with appropriate physical security controls and is the responsibility of subservice organization. Physical security and environmental controls have been implemented to protect systems inside the server room by the subservice organization. The SOC 2 report of subservice organization should be reviewed on an annual basis to evaluate the effectiveness of the controls at the subservice organization. 

## Privacy 

### Personal Data 

Company personnel must treat personal data with appropriate security and handling and accommodate data subject requests, as required by applicable laws and regulations. No unauthorized personnel should have access to personal data. Additionally, to ensure compliance with HIPAA, satisfactory assurances required by the vendor with respect to create, receive, maintain, or transmit electronic protected health information on behalf of the entity be documented through a written contract or other arrangement with the business associate that meets the applicable requirements. 

## System Access Security 

Graphene adheres to the principle of least privilege, specifying that team members will be given access to only the information and resources necessary to perform their job functions as determined by management or a designee. Requests for escalation of privileges or changes to privileges and access permissions are documented and require approval by an authorized manager. System access is revoked immediately upon termination or resignation. 

### Account Audits 


Audits of access and privileges to sensitive Company applications, infrastructure, systems, and data are performed regularly and reviewed by authorized personnel. 

## Asset Security 

Graphene maintains an Asset Register or Asset Monitoring Tool designed to track and set configuration in line with the following baseline hardening standards: 

 The company maintains an inventory of its assets including details on asset ownership and location. The asset inventory listing is reviewed and updated by management on an as-needed basis or at least annually. Disk encryption and system passwords should be enabled across all organization workstations. Use of Removable media should be restricted. In case removable media is required to transfer restricted data to people or entities outside the company or authorized users, an appropriate approval should be required for such use. Anti-virus and Malware protection software should be installed and configured for Windows-based workstations and laptops. The Anti-virus should set up to automatically update on a daily basis. Workstations should be configured to receive automatic patch updates. In addition, workstation must be scanned to test patch compliance on a daily basis. The company should engage a third‐party for sanitizing digital media to remove any data and software prior to its disposal/degaussing. Any removal of devices or media from the inventory list during the in-scope period triggers a verification process. Documentation is required to provide evidence of proper removal of electronic Protected Health Information (ePHI). This includes a signed form by the employees responsible for the removal, confirming that ePHI has been appropriately erased. Additionally, the training provided to employees responsible for the disposal of electronic media includes best practices for secure removal, ensuring compliance with the above standards and documentation requirements. 

## Data Management 

Graphene stores and disposes of sensitive data, in a manner that; reasonably safeguards the confidentiality of the data; protects against the unauthorized use or disclosure of the data; and renders the data secure or appropriately destroyed. Data entered into Company applications must be validated where possible to ensure quality of information processed and to mitigate the impacts of web-based attacks on the systems. 

## Data Protection 

Graphene uses its cloud provider key management service to encrypt data at rest and to store and manage encryption keys. Access to production environment's access keys is restricted to authorized individuals. 

## Data Transmission 

Encryption technologies are used to protect communication and transmission of data over public networks. Also, the organization uses DLP (Data Loss Prevention) software to prevent sensitive information from being transmitted over email. 

## Data Classification 

Graphene defines the handling and classification of data in the Data Classification Policy. 

## Anti Virus and Anti Malware 

Anti-virus and Malware protection software must be installed and configured on all production servers to prevent or detect and act upon the introduction of unauthorized or malicious software. The Anti-virus should be configured to automatically scan on a continuous basis. For production servers, the Anti-virus definitions should be updated on a weekly basis. 


## Vulnerability and Patch Management 

Graphene uses a proactive vulnerability and patch management process that prioritizes and implements patches based on classification. Such classification may include whether the severity is security-related or based on other additional factors. Graphene uses an automated tool to perform vulnerability assessment on infrastructure and applications. Vulnerability scans are performed monthly with the scan frequency adjusted, as required, to meet ongoing and changing commitments and requirements. Vulnerability management must include systematic identification, assessment, and remediation of security vulnerabilities, with prioritization based on risk level and potential impact to information security. The IT and Engineering department review the vulnerabilities and takes necessary actions on vulnerabilities identified as high and critical. A remediation plan is developed, and changes are implemented to remediate critical and high vulnerabilities at a minimum. The resolution of such vulnerabilities follows the incident response plan. A patch management process exists to confirm that operating system level vulnerabilities must be remediated in a timely manner. In addition, production servers must be scanned to test patch compliance on an ongoing basis. IT leadership team on a monthly basis makes assessments on the patches and approves for implementation to ensure critical patches must be updated on a timely basis. 

## Change and Development Management 

To protect against unauthorized changes and the introduction of malicious code, Graphene maintains a Change Management Policy with change management procedures that address the types of changes, required documentation, required review and/or approvals, and emergency changes. Changes to Company production infrastructure, systems, and applications must be documented, tested, and approved before deployment. 

### Environment Separation 

As necessary, Graphene maintains requirements and controls for the separation of development and production environments. 

### Source Code 

Graphene controlled directories or repositories containing source code are secured from unauthorized access. 

## Logging and Monitoring 

Graphene collects & monitors audit logs and alerts on key events stemming from production systems, applications, databases, servers, message queues, load balancers, and critical services, as well as IAM user and admin activities. IT team continuously monitors system capacity and performance through the use of monitoring tools to identify and detect anomalies that could compromise availability of the system operations. Logging should be enabled to monitor activities such as administrative activities, logon attempts, data deletions at the application and infrastructure level, changes to functions, security configurations, permissions, and roles. Logs must be securely stored and archived for a minimum of 1 year to assist with potential forensic efforts. Logs are made available to relevant team members for troubleshooting, auditing, and capacity planning activities. System and user activity logs may be utilized to assess the causes of incidents and problems. Graphene utilizes access control to prevent unauthorized access, deletion, or tampering of logging facilities and log information. Additionally, the monitoring tool generates alerts when specific predefined thresholds are met. Graphene correlates these events and alerts across all sources to identify root causes and formally declare incidents, as necessary, in accordance with the Security Incident Response Policy and Change Management Policy. 

## Security Incident Response 

Graphene maintains a plan that defines responsibilities, detection, and corrective actions during a security incident. The plan will be executed following the discovery of an incident such as system compromise, or unintended/unauthorized acquisition, access, use or release of non-public information. The plan is tested, reviewed 


# Kevin Marr 

 Primary Signatory 

# Grant Marvin 

 Secondary Signatory 

**Approved On: 01/14/2026** 

**Version: 1** 

and updated at least annually. Incident response procedures must ensure timely detection, effective response, and proper handling of security incidents while maintaining communication with affected parties and documenting lessons learned. Graphene utilizes various monitoring and surveillance tools to detect security threats and incidents. Early detection and response can mitigate damages and minimize further risk to Graphene. A message should be sent to security@graphenedata.com if you believe there may be a security incident or threat. 

## Risk Management 

Graphene requires a risk assessment to be performed at least annually. For risks identified during the process, Graphene must classify the risks and develop action plans to mitigate discovered risks. 

## Vendor Management 

Graphene requires a vendor security assessment before third party products or services are used confirming the provider can maintain appropriate security and privacy controls. The review may include gathering applicable compliance audits (SOC 1, SOC 2, PCI DSS, HITRUST, ISO27001, etc.) or other security compliance evidence. Agreements will be updated and amended as necessary when business, laws, and regulatory requirements change. 

## Non-Compliance 

Any violation of this policy or any other Company policy or procedure may result in disciplinary action, up to and including termination of employment. Graphene reserves the right to notify the appropriate law enforcement authorities of any unlawful activity and to cooperate in any investigation of such activity. Graphene does not consider conduct in violation of this policy to be within an employee's or contractor's course and scope of work. Any employee or contractor who is requested to undertake an activity that he or she believes is in violation of this policy must provide a written or verbal complaint to his or her manager or any other manager of Graphene as soon as possible. The disciplinary process should also be used as a deterrent to prevent employees and contractors from violating organizational security policies and procedures, and any other security breaches. 

## Review and Update 

Graphene reviews and updates its security policies and plans to maintain organizational security objectives and meet regulatory requirements at least annually. The results are shared with appropriate parties internally and findings are tracked to resolution. Any changes are communicated across the organization. 


