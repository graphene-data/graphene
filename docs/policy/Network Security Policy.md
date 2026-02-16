# Network Security Policy 

## Purpose 

Graphene shall safeguard its internal network, network connections, and resources against unauthorized access. The main objective is to uphold the security of Graphene's infrastructure and data. Hence, this policy describes rules that ensure the reliability and availability of network devices, facilitating safe and secure connections to Graphene's information assets. 

## Scope 

This policy applies to all network devices including routers, switches, wireless access points, firewalls, and other network services that are owned and administered by Graphene. The policy covers all aspects of IT network administration, from design and installation to testing, support, and management. 

## Policy 

Graphene's network and public websites must be protected against breaches and network failures which could potentially harm the confidentiality, availability, and integrity of information and associated assets. Network connections between Graphene and external parties such as vendors, customers, and subsidiaries, should only be established after a formal risk assessment has been conducted and appropriate authorization granted. Graphene's networks should be separated from external networks using firewalls. Graphene is responsible for protecting the interconnecting customer networks from potential threats originating within Graphene. 

## Network Security Management 

Network devices owned and supervised by Graphene should be securely configured and built to protect network traffic moving between trusted and untrusted network zones. Each network device installed in the Graphene network must have suitable configurations and meet security needs based on their specific roles (such as internal, public-facing, or demilitarized zones). All traffic and protocols shall be explicitly blocked, except for those required for business operations. To prevent unauthorized access, detect external security threats and to keep Company’s network separate from unsecured networks, the Internet, and third-party networks, Graphene uses firewalls and intrusion detection systems. System firewalls are configured on the application gateway and production network to limit unnecessary ports, protocols, and services. Firewall rules are reviewed on an annual basis by IT management. The IT department shall decide whether personal firewalls should be installed on individual workstations. All remote access to Graphene systems must occur through a sanctioned medium, like a VPN, based on thorough risk assessment and proper authorizations. Also, utilize VPN connections over public networks for encrypting sensitive information and management limits VPN access to authorized individuals. Administrator access to the VPN console is restricted to authorized individuals. All intranet users who connect from the Internet need to authenticate their identity over an encrypted connection. The password policy is strictly enforced for all applications used over the Internet. As much as possible, duties will be separated for personnel working on network operations and computer operations. Permission from the IT Department must be obtained before using wireless connections. The data involved in application service transactions needs to be protected to prevent incomplete transmission, misrouting, unauthorized message modification, unauthorized disclosure, unauthorized message duplication, or replay. System components must be configured such that the company and its customers' access is appropriately segmented from other customer accounts. 

## Connections with Third Parties 

A formal agreement must be in place with vendors, customers, or partners prior to connecting to the Graphene network. 


Networks belonging to customers or partners that connect with the Graphene network will be kept separate from one another. Any traffic from customers over a dedicated link shall be encrypted using the right technology and VPN connections if the customer requests it. Access to customer networks shall only be provided to certain Graphene employees who need it for their work and have the necessary permissions. 

## Logging and Monitoring 

Logging shall be activated, especially for log configuration changes, and stored in a centralized log management tool. Every access to the network and network security products by administrators should be permitted, tracked, and overseen. The IT/Engineering team of Graphene should monitor all network services and their use. All traffic passing through the firewall should be observed for potential misuses and intrusions. Regular monitoring and optimization of resource usage should be carried out, and predictions of future capacity requirements should be made to ensure the system performs as needed. 

## Ensure Accurate Time and Date 

Align the clocks of network devices with the Network Time Protocol (NTP). Make sure all equipment is set to the correct time zone. 

## Save Network Device Setup 

The setup of network devices should be saved regularly or anytime changes are made, and this should be done to a central location. This central backup location needs to be kept secure. 

## Ensuring Router Security 

### Consider Physical Security (where applicable) 

Ensure that routers and switches are housed in a secured room, out of reach from unauthorized individuals. These devices should have effective cooling, a dependable power supply, and ideally, connected to an adequately sized uninterruptible power supply (UPS). For wireless access points, either lock them in a secure room or mount them high on ceilings to make any physical access noticeable. 

### Control of Privileged Access 

Ensure the use of complex passwords for all interfaces on routers, including Console, AUX, and VTY (telnet/ssh) interfaces, to prevent unauthorized access. Only allow authorized personnel to make configuration changes. Passwords must follow strong password principles such as being 8 characters long at minimum. Use access control to separately manage authentication, authorization, and accounting services for network-based access. A Privileged Access Management solution can be used to oversee credentials used to access the device and commands that can be run during a session, thus providing a comprehensive audit trail of commands and sessions. 

### Safeguarding Switches 

Each switch port should be secured by enabling port security features that permit access solely to the first authorized device that connects to the port. 

### Network Design and Auditing 

Graphene network's design should allow legitimate traffic to flow towards the right zones, segments, or resources, and identify and discard unwanted traffic. This can be achieved through the use of firewalls, Virtual Local Area Networks (VLANs), and Access Control Lists (ACLs). 


# Kevin Marr Grant Marvin 

Keep development/testing, production, and corporate resources on separate network segments as appropriate. Ensure that IP phones and IoT devices, if used, are logically separated within the network. A network diagram should provide a visual representation of deployed network devices and traffic flows, and should also highlight both physical and logical security controls designed to guide legitimate traffic and detect and discard irrelevant or unwanted traffic. This network diagram should be reviewed annually by IT/Engineering Management. Graphene should test firewall policies and ACLs to ensure that any unauthorized activity is blocked. Perform audits of the network, carrying out vulnerability scans and penetration tests as appropriate on key areas of the network and addressing any identified high-risk issues. 

### Securing Sensitive Network Traffic 

Make sure to use suitable encryption and authentication techniques when transmitting sensitive data or when accessing the network remotely. 

### Building and Sustaining Skills 

Guarantee that Graphene’s network support team has the necessary training and internal communication to establish and maintain a secure network infrastructure. 

### Updating and Patching 

Network devices are updated and patched regularly following a clearly defined schedule. Necessary critical security patches provided by vendors should be installed within a set period of time after they are released. All other relevant security patches provided by vendors should be installed according to the patching schedule. Besides the patching guidelines, any vulnerabilities or potential risks that Graphene considers critical must be patched as soon as possible. 

### Mobile Device Management 

The company has a mobile device management (MDM) system in place to centrally manage endpoint devices supporting the service to the customer. The MDM tool is appropriately configured to prevent against unauthorized or inappropriate connectivity of endpoint devices to Graphene's environment. 

## Technical and Security Standards 

Devices must be updated consistently and run the latest OS available. Devices need to be set up with a secure password in line with Graphene's password policy. This password should be unique and not be the same as any other used within the organization. Users agree not to share their passwords with anyone and must auto-lock with a password or PIN after a period of inactivity. Only IT-managed or IT-approved devices can directly connect to the internal corporate network and Graphene's IT department will inspect all personal mobile devices attempting to connect to the corporate network via the internet. Devices that are not IT-supported, not in compliance with IT's security policies, or pose any threat to the corporate network or data will not be granted access. Such devices shall comply with the existing rules on security features like encryption, password, key lock, etc. The IT department will enforce these policies using Mobile Device Management (MDM) software whenever possible. Any attempt to undermine or bypass the MDM system will result in immediate disconnection from all corporate resources, and additional actions may follow according to Graphene's comprehensive security policy. Devices may only connect to the corporate network and data over the internet via a Secure Socket Layer (SSL) Virtual Private Network (VPN). Smart mobile devices like smartphones, tablets, and laptops will connect to the corporate network and data using mobile VPN software installed on the device by IT. 


 Primary Signatory Secondary Signatory 

**Approved On: 01/14/2026** 

**Version: 1** 


