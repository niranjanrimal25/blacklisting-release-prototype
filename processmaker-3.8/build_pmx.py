#!/usr/bin/env python3
"""
Build ProcessMaker 3.8 .pmx file for Blacklisting Release Full SOP
Based on Credit_Card_Application.pmx structure
"""

import random
import json
import os

def gen_uid():
    # PM UID is 32 chars, alphanumeric, first char not 0?
    return ''.join(random.choice('0123456789abcdef') for _ in range(32))

# Generate UIDs
prj_uid = gen_uid()
pro_uid = gen_uid()
dia_uid = gen_uid()
lns_uid = gen_uid()

# Lanes
lane_initiator_uid = gen_uid()
lane_reviewer_uid = gen_uid()
lane_brops_uid = gen_uid()
lane_cad_uid = gen_uid()

# Activities (BPMN)
act_identify = gen_uid()
act_select_type = gen_uid()
act_upload_docs = gen_uid()
act_brops_pool = gen_uid()
act_review = gen_uid()
act_rectify = gen_uid()
act_clarify = gen_uid()
act_letter_initiator = gen_uid()
act_letter_cad = gen_uid()
act_cad_validation = gen_uid()

# Events
evn_start = gen_uid()
evn_end_released = gen_uid()
evn_end_rejected = gen_uid()
evn_end_cancelled = gen_uid()

# Gateways
gat_route_mode = gen_uid()
gat_review_decision = gen_uid()
gat_letter_owner = gen_uid()
gat_cad_decision = gen_uid()

# Flows
flows = []
def add_flow(origin, origin_type, dest, dest_type, condition="", name=" "):
    flows.append({
        "uid": gen_uid(),
        "origin": origin,
        "origin_type": origin_type,
        "dest": dest,
        "dest_type": dest_type,
        "condition": condition,
        "name": name
    })

# Build flow sequence
add_flow(evn_start, "bpmnEvent", act_identify, "bpmnActivity")
add_flow(act_identify, "bpmnActivity", act_select_type, "bpmnActivity")
add_flow(act_select_type, "bpmnActivity", act_upload_docs, "bpmnActivity")
add_flow(act_upload_docs, "bpmnActivity", gat_route_mode, "bpmnGateway")
add_flow(gat_route_mode, "bpmnGateway", act_brops_pool, "bpmnActivity", "@@routeMode == \"pool\"")
add_flow(gat_route_mode, "bpmnGateway", act_review, "bpmnActivity", "@@routeMode != \"pool\"")
add_flow(act_brops_pool, "bpmnActivity", act_review, "bpmnActivity")
add_flow(act_review, "bpmnActivity", gat_review_decision, "bpmnGateway")
add_flow(gat_review_decision, "bpmnGateway", act_letter_initiator, "bpmnActivity", "@@reviewDecision == \"APPROVE\" && @@letterOwner == \"initiator\"")
add_flow(gat_review_decision, "bpmnGateway", act_letter_cad, "bpmnActivity", "@@reviewDecision == \"APPROVE\" && @@letterOwner == \"cad\"")
add_flow(gat_review_decision, "bpmnGateway", act_rectify, "bpmnActivity", "@@reviewDecision == \"RETURN\"")
add_flow(gat_review_decision, "bpmnGateway", act_clarify, "bpmnActivity", "@@reviewDecision == \"QUERY\"")
add_flow(gat_review_decision, "bpmnGateway", evn_end_rejected, "bpmnEvent", "@@reviewDecision == \"REJECT\"")
add_flow(act_rectify, "bpmnActivity", act_review, "bpmnActivity")
add_flow(act_clarify, "bpmnActivity", act_review, "bpmnActivity")
add_flow(act_letter_initiator, "bpmnActivity", act_cad_validation, "bpmnActivity")
add_flow(act_letter_cad, "bpmnActivity", act_cad_validation, "bpmnActivity")
add_flow(act_cad_validation, "bpmnActivity", gat_cad_decision, "bpmnGateway")
add_flow(gat_cad_decision, "bpmnGateway", evn_end_released, "bpmnEvent", "@@cadDecision == \"RELEASE\"")
add_flow(gat_cad_decision, "bpmnGateway", act_rectify, "bpmnActivity", "@@cadDecision == \"CAD_RETURN\"")
add_flow(gat_cad_decision, "bpmnGateway", act_clarify, "bpmnActivity", "@@cadDecision == \"CAD_QUERY\"")
add_flow(gat_cad_decision, "bpmnGateway", act_cad_validation, "bpmnActivity", "@@cadDecision == \"CIB_REPORTED\" || @@cadDecision == \"RESUME_VALIDATION\"")

# Dynaforms UIDs
dyn_identify = gen_uid()
dyn_type_select = gen_uid()
dyn_details_applicant = gen_uid()
dyn_details_ac = gen_uid()
dyn_details_court = gen_uid()
dyn_details_npa = gen_uid()
dyn_details_partial = gen_uid()
dyn_details_temp = gen_uid()
dyn_doc_check = gen_uid()
dyn_review = gen_uid()
dyn_letter_init = gen_uid()
dyn_letter_cad = gen_uid()
dyn_cad_val = gen_uid()

# Triggers UIDs
trg_lookup = gen_uid()
trg_validate_type = gen_uid()
trg_maker_check = gen_uid()
trg_validate_review = gen_uid()
trg_check_signed = gen_uid()
trg_cad_attach = gen_uid()
trg_release = gen_uid()

# Input Docs
in_docs = [
    ("IN_COPY_CHEQUE", "Copy of cheque"),
    ("IN_PAYEE_APPLICATION", "Application from payee"),
    ("IN_MDR_COPY", "MDR copy"),
    ("IN_ID_HOLDER", "ID holder"),
    ("IN_CIB_INCLUSION", "CIB Inclusion Letter"),
    ("IN_BLACKLIST_DOCS", "Blacklist docs"),
    ("IN_DEBIT_AUTHORITY", "Debit Authority"),
    ("IN_COURT_LETTER", "Court letter"),
    ("IN_LEGAL_CONSENT", "Legal consent"),
    ("IN_BOC_APPROVAL", "BOC approval"),
    ("IN_LOAN_REGULARIZATION", "Loan regularization"),
    ("IN_NRRC_MINUTE", "NRRC minute"),
    ("IN_GUARANTOR_SETTLEMENT", "Guarantor settlement"),
    ("IN_PAYMENT_PLAN", "Payment plan"),
    ("IN_COMMITTEE_MINUTE", "Committee minute"),
    ("IN_SIGNED_LETTER", "Signed CIB Release Letter"),
    ("IN_CAD_RETURN_ATTACH", "CAD Return attachment"),
    ("IN_CIB_RETURN_FEEDBACK", "CIB Return feedback"),
]

# Output Docs
out_docs = [
    ("OD_CIB_RELEASE_LETTER", "CIB Release Letter"),
    ("OD_FINAL_RELEASE", "Final Release Document"),
]

# Read dynaform JSONs if exist, else use minimal
def read_dynaform_json(name):
    path = f"dynaforms/{name}.json"
    if os.path.exists(path):
        with open(path, 'r') as f:
            data = json.load(f)
            # Return as JSON string for dyn_content
            return json.dumps(data)
    return json.dumps({"name": name, "items": []})

def read_trigger_php(name):
    path = f"triggers/{name}.php"
    if os.path.exists(path):
        with open(path, 'r') as f:
            return f.read()
    return "// Trigger "+name

def read_output_html(name):
    path = f"output_documents/{name}.html"
    if os.path.exists(path):
        with open(path, 'r') as f:
            return f.read()
    return "<html><body>Output "+name+" @@partyName</body></html>"

# Build PMX XML
pmx = f'''<?xml version="1.0" encoding="utf-8"?>
<ProcessMaker-Project version="3.8">
  <metadata>
    <meta key="vendor_version">3.8.0-community</meta>
    <meta key="vendor_version_code">BlacklistingRelease</meta>
    <meta key="export_timestamp">{random.randint(1000000000, 2000000000)}</meta>
    <meta key="export_datetime"><![CDATA[2026-08-24T00:00:00+00:00]]></meta>
    <meta key="export_server_os">Linux</meta>
    <meta key="workspace">workflow</meta>
    <meta key="name">Blacklisting Release Full SOP</meta>
    <meta key="uid">{prj_uid}</meta>
  </metadata>
  <definition class="BPMN">
    <table name="PROCESS">
      <record>
        <pro_uid>{pro_uid}</pro_uid>
        <prj_uid>{prj_uid}</prj_uid>
        <dia_uid>{dia_uid}</dia_uid>
        <pro_name>Blacklisting Release Full SOP</pro_name>
        <pro_type>NONE</pro_type>
        <pro_is_executable>0</pro_is_executable>
        <pro_is_closed>0</pro_is_closed>
        <pro_is_subprocess>0</pro_is_subprocess>
      </record>
    </table>
    <table name="DIAGRAM">
      <record>
        <dia_uid>{dia_uid}</dia_uid>
        <prj_uid>{prj_uid}</prj_uid>
        <dia_name>Blacklisting Release Full SOP</dia_name>
        <dia_is_closable>0</dia_is_closable>
      </record>
    </table>
    <table name="LANESET">
      <record>
        <lns_uid>{lns_uid}</lns_uid>
        <prj_uid>{prj_uid}</prj_uid>
        <pro_uid>{pro_uid}</pro_uid>
        <lns_name>Blacklisting Release</lns_name>
        <lns_parent_lane></lns_parent_lane>
        <lns_is_horizontal>1</lns_is_horizontal>
      </record>
    </table>
    <table name="LANE">
      <record><lan_uid>{lane_initiator_uid}</lan_uid><prj_uid>{prj_uid}</prj_uid><lns_uid>{lns_uid}</lns_uid><lan_name>Initiator Branch/NPA/CSD</lan_name></record>
      <record><lan_uid>{lane_reviewer_uid}</lan_uid><prj_uid>{prj_uid}</prj_uid><lns_uid>{lns_uid}</lns_uid><lan_name>Reviewer OI/BM</lan_name></record>
      <record><lan_uid>{lane_brops_uid}</lan_uid><prj_uid>{prj_uid}</prj_uid><lns_uid>{lns_uid}</lns_uid><lan_name>BROPs Pool</lan_name></record>
      <record><lan_uid>{lane_cad_uid}</lan_uid><prj_uid>{prj_uid}</prj_uid><lns_uid>{lns_uid}</lns_uid><lan_name>CAD/CIC</lan_name></record>
    </table>
    <table name="ACTIVITY">
      <record><act_uid>{act_identify}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>Identify Blacklisted Case</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_task_type></record>
      <record><act_uid>{act_select_type}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>Select Release Type &amp; Details</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
      <record><act_uid>{act_upload_docs}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>Upload Mandatory Documents</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
      <record><act_uid>{act_brops_pool}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>BROPs Pool - Claim</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
      <record><act_uid>{act_review}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>Review - Approve/Return/Query/Forward/Reject</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
      <record><act_uid>{act_rectify}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>Rectify After Return</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
      <record><act_uid>{act_clarify}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>Clarify After Query</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
      <record><act_uid>{act_letter_initiator}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>Letter - Initiator Signs</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
      <record><act_uid>{act_letter_cad}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>Letter - CAD Completes</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
      <record><act_uid>{act_cad_validation}</act_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><act_name>CAD/CIC Final Validation</act_name><act_type>TASK</act_type><act_task_type>EMPTY</act_type></record>
    </table>
    <table name="EVENT">
      <record><evn_uid>{evn_start}</evn_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><evn_name>Start</evn_name><evn_type>START</evn_type><evn_marker>EMPTY</evn_marker><evn_behavior>CATCH</evn_behavior><evn_message>LEAD</evn_message></record>
      <record><evn_uid>{evn_end_released}</evn_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><evn_name>Released</evn_name><evn_type>END</evn_type><evn_marker>EMPTY</evn_marker><evn_behavior>THROW</evn_behavior></record>
      <record><evn_uid>{evn_end_rejected}</evn_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><evn_name>Rejected</evn_name><evn_type>END</evn_type><evn_marker>EMPTY</evn_marker><evn_behavior>THROW</evn_behavior></record>
      <record><evn_uid>{evn_end_cancelled}</evn_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><evn_name>Cancelled</evn_name><evn_type>END</evn_type><evn_marker>EMPTY</evn_marker><evn_behavior>THROW</evn_behavior></record>
    </table>
    <table name="GATEWAY">
      <record><gat_uid>{gat_route_mode}</gat_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><gat_name>Route by Reporting Structure</gat_name><gat_type>EXCLUSIVE</gat_type><gat_direction>DIVERGING</gat_direction></record>
      <record><gat_uid>{gat_review_decision}</gat_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><gat_name>Review Decision</gat_name><gat_type>EXCLUSIVE</gat_type><gat_direction>DIVERGING</gat_direction></record>
      <record><gat_uid>{gat_letter_owner}</gat_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><gat_name>Letter Owner</gat_name><gat_type>EXCLUSIVE</gat_type><gat_direction>DIVERGING</gat_direction></record>
      <record><gat_uid>{gat_cad_decision}</gat_uid><prj_uid>{prj_uid}</prj_uid><pro_uid>{pro_uid}</pro_uid><gat_name>CAD Decision</gat_name><gat_type>EXCLUSIVE</gat_type><gat_direction>DIVERGING</gat_direction></record>
    </table>
    <table name="FLOW">
'''

for fl in flows:
    pmx += f'''
      <record>
        <flo_uid>{fl['uid']}</flo_uid>
        <prj_uid>{prj_uid}</prj_uid>
        <dia_uid>{dia_uid}</dia_uid>
        <flo_type>SEQUENCE</flo_type>
        <flo_name>{fl['name']}</flo_name>
        <flo_element_origin>{fl['origin']}</flo_element_origin>
        <flo_element_origin_type>{fl['origin_type']}</flo_element_origin_type>
        <flo_element_dest>{fl['dest']}</flo_element_dest>
        <flo_element_dest_type>{fl['dest_type']}</flo_element_dest_type>
        <flo_condition><![CDATA[{fl['condition']}]]></flo_condition>
      </record>'''

pmx += f'''
    </table>
  </definition>
  <definition class="workflow">
    <table name="process">
      <record>
        <pro_uid>{prj_uid}</pro_uid>
        <pro_title>Blacklisting Release Full SOP</pro_title>
        <pro_description>End-to-end blacklisting release: DigiHost auto-population, 6 types, BROPs pool, letter generation, CAD validation, auto-unfreeze</pro_description>
        <pro_status>ACTIVE</pro_status>
        <pro_type>NORMAL</pro_type>
        <pro_bpmn>1</pro_bpmn>
      </record>
    </table>
    <table name="tasks">
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_identify}</tas_uid><tas_title>Identify Blacklisted Case</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>1</tas_duration><tas_timeunit>DAYS</tas_timeunit><tas_start>TRUE</tas_start></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_select_type}</tas_uid><tas_title>Select Release Type &amp; Details</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>1</tas_duration><tas_timeunit>DAYS</tas_timeunit></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_upload_docs}</tas_uid><tas_title>Upload Mandatory Documents</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>1</tas_duration><tas_timeunit>DAYS</tas_timeunit></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_brops_pool}</tas_uid><tas_title>BROPs Pool - Claim</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>1</tas_duration><tas_timeunit>DAYS</tas_timeunit><tas_self_service>TRUE</tas_self_service></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_review}</tas_uid><tas_title>Review - Approve/Return/Query/Forward/Reject</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>BALANCED</tas_assign_type><tas_duration>2</tas_duration><tas_timeunit>DAYS</tas_timeunit></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_rectify}</tas_uid><tas_title>Rectify After Return</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>2</tas_duration><tas_timeunit>DAYS</tas_timeunit></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_clarify}</tas_uid><tas_title>Clarify After Query</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>2</tas_duration><tas_timeunit>DAYS</tas_timeunit></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_letter_initiator}</tas_uid><tas_title>Letter - Initiator Signs</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>1</tas_duration><tas_timeunit>DAYS</tas_timeunit></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_letter_cad}</tas_uid><tas_title>Letter - CAD Completes</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>1</tas_duration><tas_timeunit>DAYS</tas_timeunit></record>
      <record><pro_uid>{prj_uid}</pro_uid><tas_uid>{act_cad_validation}</tas_uid><tas_title>CAD/CIC Final Validation</tas_title><tas_type>NORMAL</tas_type><tas_assign_type>SELF_SERVICE</tas_assign_type><tas_duration>3</tas_duration><tas_timeunit>DAYS</tas_timeunit></record>
    </table>
    <table name="routes">
'''

# Routes mirroring flows but for workflow engine
for fl in flows:
    # Need to map BPMN flow to workflow route: from task to next task
    # Skip flows from gateways (they are handled via conditions in gateway, but PM3 workflow routes also need conditions)
    # We'll create routes for task->task only, gateway conditions will be in trigger or route condition
    if "bpmnActivity" in fl['origin_type'] and "bpmnActivity" in fl['dest_type']:
        pmx += f'''
      <record>
        <pro_uid>{prj_uid}</pro_uid>
        <tas_uid>{fl['origin']}</tas_uid>
        <rou_next_task>{fl['dest']}</rou_next_task>
        <rou_condition><![CDATA[{fl['condition']}]]></rou_condition>
        <rou_type>SEQUENTIAL</rou_type>
      </record>'''
    elif "bpmnActivity" in fl['origin_type'] and "bpmnGateway" in fl['dest_type']:
        # Task to gateway is implicit, next task will be after gateway with condition
        pass
    elif "bpmnGateway" in fl['origin_type'] and "bpmnActivity" in fl['dest_type']:
        # Gateway to task: need to find previous task? For simplicity, create route from previous task to this dest with condition
        # We'll create route from act_upload_docs to act_brops_pool etc with condition
        # Already handled via direct task->task for simplicity, so add route with condition
        # Find previous task: for routeMode gateway, previous is act_upload_docs
        if fl['origin'] == gat_route_mode:
            pmx += f'''
      <record>
        <pro_uid>{prj_uid}</pro_uid>
        <tas_uid>{act_upload_docs}</tas_uid>
        <rou_next_task>{fl['dest']}</rou_next_task>
        <rou_condition><![CDATA[{fl['condition']}]]></rou_condition>
        <rou_type>EVALUATE</rou_type>
      </record>'''
        elif fl['origin'] == gat_review_decision:
            pmx += f'''
      <record>
        <pro_uid>{prj_uid}</pro_uid>
        <tas_uid>{act_review}</tas_uid>
        <rou_next_task>{fl['dest']}</rou_next_task>
        <rou_condition><![CDATA[{fl['condition']}]]></rou_condition>
        <rou_type>EVALUATE</rou_type>
      </record>'''
        elif fl['origin'] == gat_cad_decision:
            pmx += f'''
      <record>
        <pro_uid>{prj_uid}</pro_uid>
        <tas_uid>{act_cad_validation}</tas_uid>
        <rou_next_task>{fl['dest']}</rou_next_task>
        <rou_condition><![CDATA[{fl['condition']}]]></rou_condition>
        <rou_type>EVALUATE</rou_type>
      </record>'''

pmx += '''
    </table>
    <table name="dynaforms">
'''

# Add dynaforms
dynaforms = [
    (dyn_identify, "DF_IDENTIFY_CASE"),
    (dyn_type_select, "DF_RELEASE_TYPE_SELECT"),
    (dyn_details_applicant, "DF_TYPE_DETAILS_APPLICANT_CHEQUE"),
    (dyn_details_ac, "DF_TYPE_DETAILS_AC_HOLDER"),
    (dyn_details_court, "DF_TYPE_DETAILS_COURT"),
    (dyn_details_npa, "DF_TYPE_DETAILS_NPA"),
    (dyn_details_partial, "DF_TYPE_DETAILS_PARTIAL"),
    (dyn_details_temp, "DF_TYPE_DETAILS_TEMPORARY"),
    (dyn_doc_check, "DF_DOCUMENT_CHECKLIST"),
    (dyn_review, "DF_REVIEW_DECISION"),
    (dyn_letter_init, "DF_LETTER_INITIATOR"),
    (dyn_letter_cad, "DF_LETTER_CAD"),
    (dyn_cad_val, "DF_CAD_VALIDATION"),
]

for uid, name in dynaforms:
    content = read_dynaform_json(name).replace("]]>", "]]]]><![CDATA[>")
    pmx += f'''
      <record>
        <dyn_uid>{uid}</dyn_uid>
        <pro_uid>{prj_uid}</pro_uid>
        <dyn_title>{name}</dyn_title>
        <dyn_type>xmlform</dyn_type>
        <dyn_content><![CDATA[{content}]]></dyn_content>
      </record>'''

pmx += '''
    </table>
    <table name="triggers">
'''

triggers = [
    (trg_lookup, "TRG_LOOKUP_BLACKLIST"),
    (trg_validate_type, "TRG_VALIDATE_TYPE_FIELDS"),
    (trg_maker_check, "TRG_MAKER_COMPLETENESS_CHECK"),
    (trg_validate_review, "TRG_VALIDATE_REVIEW"),
    (trg_check_signed, "TRG_CHECK_SIGNED_LETTER"),
    (trg_cad_attach, "TRG_CAD_VALIDATE_ATTACHMENT"),
    (trg_release, "TRG_RELEASE_BLACKLIST"),
]

for uid, name in triggers:
    php = read_trigger_php(name).replace("]]>", "]]]]><![CDATA[>")
    pmx += f'''
      <record>
        <tri_uid>{uid}</tri_uid>
        <pro_uid>{prj_uid}</pro_uid>
        <tri_title>{name}</tri_title>
        <tri_type>SCRIPT</tri_type>
        <tri_webbot><![CDATA[{php}]]></tri_webbot>
      </record>'''

pmx += '''
    </table>
    <table name="input_documents">
'''

for uid, title in in_docs:
    # Generate random doc uid if not provided as UID
    doc_uid = gen_uid()
    pmx += f'''
      <record>
        <inp_doc_uid>{doc_uid}</inp_doc_uid>
        <pro_uid>{prj_uid}</pro_uid>
        <inp_doc_title>{title}</inp_doc_title>
        <inp_doc_description>{title} for blacklisting release</inp_doc_description>
      </record>'''

pmx += '''
    </table>
    <table name="output_documents">
'''

for uid, title in out_docs:
    doc_uid = gen_uid()
    html = read_output_html(title.replace(" ", "_").replace("-", "_")).replace("]]>", "]]]]><![CDATA[>")
    pmx += f'''
      <record>
        <out_doc_uid>{doc_uid}</out_doc_uid>
        <pro_uid>{prj_uid}</pro_uid>
        <out_doc_title>{title}</out_doc_title>
        <out_doc_filename>{title.replace(" ", "_")}</out_doc_filename>
        <out_doc_template><![CDATA[{html}]]></out_doc_template>
      </record>'''

pmx += '''
    </table>
  </definition>
</ProcessMaker-Project>
'''

out_path = "Blacklisting_Release_Full_SOP.pmx"
with open(out_path, 'w', encoding='utf-8') as f:
    f.write(pmx)

print(f"Generated {out_path} with PRJ_UID {prj_uid}")
