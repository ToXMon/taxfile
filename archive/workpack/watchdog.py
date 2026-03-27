#!/usr/bin/env python3
"""
TaxFile Build Watchdog — Self-healing supervisor.
Detects stuck/failed builds, determines resume point, restarts.
Updates Linear on status changes. Notifies only on actual events.
"""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

BASE = '/a0/usr/workdir/taxfile'
WORKPACK = '/a0/usr/workdir/taxfile-workpack'
STATE_FILE = f'{WORKPACK}/.watchdog-state.json'
LINEAR_KEY_FILE = '/tmp/linear_key.txt'

# Linear constants
TEAM_ID = '65e233bd-4511-4ee3-adee-91d9b5526234'
PROJECT_ID = 'aaf7c8c4-19dc-487a-bc86-7299edd860ed'
STATE_BACKLOG = '88c8b2a4-d880-449e-9f09-29cdbeb22049'
STATE_IN_PROGRESS = 'f91f148a-6f45-494e-84c7-6d9abfc1d86f'
STATE_DONE = '39312977-507e-4a26-8f7e-3ac6d5d2bff98'

# Task -> primary output file that proves task is done
# If the file exists, the task is considered complete
TASK_FILES = {
    '0001': 'package.json',
    '0002': 'AGENTS.md',
    '0003': 'src/lib/types.ts',
    '0004': 'src/lib/db/index.ts',
    '0005': 'src/lib/utils.ts',
    '0006': 'src/config/tax-year/2025/federal-brackets.ts',
    '0007': 'src/config/tax-year/2025/nj-brackets.ts',
    '0008': 'src/config/tax-year/2025/credits.ts',
    '0009': '.eslintrc.json',
    '0010': 'src/app/page.tsx',
    '0011': 'src/modules/document-extraction/AGENTS.md',
    '0012': 'src/modules/document-extraction/ocr/client-ocr.ts',
    '0013': 'src/modules/document-extraction/ocr/server-ocr.ts',
    '0014': 'src/modules/document-extraction/mappers/w2-mapper.ts',
    '0015': 'src/modules/document-extraction/mappers/1099-int-mapper.ts',
    '0016': 'src/modules/document-extraction/mappers/1099-div-mapper.ts',
    '0017': 'src/modules/document-extraction/mappers/1099-b-mapper.ts',
    '0018': 'src/modules/document-extraction/mappers/1099-nec-misc-mapper.ts',
    '0019': 'src/modules/document-extraction/mappers/1098-family-mapper.ts',
    '0020': 'src/modules/document-extraction/pipeline.ts',
    '0021': 'src/modules/tax-engine/AGENTS.md',
    '0022': 'src/modules/tax-engine/federal/income-aggregation.ts',
    '0023': 'src/modules/tax-engine/federal/schedule-b.ts',
    '0024': 'src/modules/tax-engine/federal/schedule-1.ts',
    '0025': 'src/modules/tax-engine/federal/schedule-d.ts',
    '0026': 'src/modules/tax-engine/federal/deduction-resolver.ts',
    '0027': 'src/modules/tax-engine/federal/schedule-a.ts',
    '0028': 'src/modules/tax-engine/federal/form-1040-core.ts',
    '0029': 'src/modules/tax-engine/federal/schedule-2.ts',
    '0030': 'src/modules/tax-engine/federal/schedule-3.ts',
    '0031': 'src/modules/tax-engine/credits/child-tax-credit.ts',
    '0032': 'src/modules/tax-engine/credits/eitc-education.ts',
    '0033': 'src/modules/tax-engine/nj/AGENTS.md',
    '0034': 'src/modules/tax-engine/nj/schedule-b.ts',
    '0035': 'src/modules/tax-engine/nj/schedule-a.ts',
    '0036': 'src/modules/tax-engine/nj/schedule-c.ts',
    '0037': 'src/modules/tax-engine/nj/nj-1040-core.ts',
    '0038': 'src/modules/tax-engine/nj/property-tax-election.ts',
    '0039': 'src/modules/tax-engine/nj/eitc.ts',
    '0040': 'src/modules/tax-engine/orchestrator.ts',
    '0041': 'src/modules/forms-generation/AGENTS.md',
    '0042': 'src/modules/forms-generation/federal/form-1040.tsx',
    '0043': 'src/modules/forms-generation/federal/schedule-1-2-3.tsx',
    '0044': 'src/modules/forms-generation/federal/schedule-a-b.tsx',
    '0045': 'src/modules/forms-generation/federal/schedule-d-8812.tsx',
    '0046': 'src/modules/forms-generation/nj/nj-1040.tsx',
    '0047': 'src/modules/forms-generation/nj/nj-schedules.tsx',
    '0048': 'src/modules/forms-generation/assembler.tsx',
    '0050': 'src/modules/user-flow/steps/upload-step.tsx',
    '0051': 'src/modules/user-flow/steps/review-step.tsx',
    '0052': 'src/modules/user-flow/steps/questions-step.tsx',
    '0053': 'src/modules/user-flow/steps/summary-step.tsx',
    '0054': 'src/modules/user-flow/steps/forms-step.tsx',
    '0055': 'src/app/api/extract/route.ts',
    '0056': 'src/app/api/calculate/route.ts',
    '0057': 'src/components/wizard-progress.tsx',
    '0058': 'src/modules/user-flow/validation.ts',
    '0059': 'data/test-data/reference-scenario.json',
    '0060': 'data/test-results/extraction-test.json',
    '0061': 'data/test-results/federal-calc-test.json',
    '0062': 'data/test-results/nj-calc-test.json',
    '0063': 'data/test-results/full-pipeline-test.json',
    '0064': 'data/test-results/audit-trail-test.json',
    '0065': 'docs/state/tax-calculation-pipeline.mmd',
}

# Phase -> task range
PHASES = {
    1: ('0001', '0010'),
    2: ('0011', '0020'),
    3: ('0021', '0032'),
    4: ('0033', '0040'),
    5: ('0041', '0048'),
    6: ('0049', '0058'),
    7: ('0059', '0065'),
}

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {
        'build_task_uuid': None,
        'last_check': None,
        'file_snapshot': [],
        'phase_statuses': {str(p): 'Backlog' for p in PHASES},
        'last_resume_task': None,
        'consecutive_stuck': 0,
    }

def save_state(state):
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)

def get_file_snapshot():
    """Get set of all .ts/.tsx/.json/.md files in src/ and data/ (excluding node_modules)"""
    files = set()
    for root, dirs, filenames in os.walk(BASE):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.next', '.git')]
        for fn in filenames:
            if fn.endswith(('.ts', '.tsx', '.json', '.md', '.mjs')):
                rel = os.path.relpath(os.path.join(root, fn), BASE)
                files.add(rel)
    return sorted(files)

def check_tasks_done():
    """Return dict of task_num -> bool for all 65 tasks"""
    done = {}
    for task_num, filepath in TASK_FILES.items():
        done[task_num] = os.path.exists(os.path.join(BASE, filepath))
    return done

def find_resume_point(tasks_done):
    """Find the first task that is NOT done"""
    for task_num in sorted(TASK_FILES.keys()):
        if not tasks_done[task_num]:
            return task_num
    return None  # All done!

def calc_phase_statuses(tasks_done):
    """Calculate phase statuses from task completion"""
    statuses = {}
    for phase, (start, end) in PHASES.items():
        phase_tasks = [t for t in sorted(TASK_FILES.keys()) if start <= t <= end]
        completed = sum(1 for t in phase_tasks if tasks_done[t])
        total = len(phase_tasks)
        if completed == 0:
            statuses[str(phase)] = 'Backlog'
        elif completed == total:
            statuses[str(phase)] = 'Done'
        else:
            statuses[str(phase)] = 'In Progress'
    return statuses

def linear_query(query, variables=None):
    key = open(LINEAR_KEY_FILE).read().strip()
    payload = {'query': query}
    if variables:
        payload['variables'] = variables
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        'https://api.linear.app/graphql',
        data=data,
        headers={'Content-Type': 'application/json', 'Authorization': key}
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return json.loads(resp.read().decode())
    except Exception as e:
        print(f'Linear API error: {e}', file=sys.stderr)
        return None

def load_linear_issue_ids():
    env_file = f'{WORKPACK}/linear-issues.env'
    ids = {}
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if '=' in line:
                    k, v = line.split('=', 1)
                    ids[k] = v
    return ids

def update_linear_issues(phase_statuses, old_statuses, issue_ids):
    """Update Linear only for phases that changed status"""
    phase_to_issue = {
        '1': issue_ids.get('ISSUE1'),
        '2': issue_ids.get('ISSUE2'),
        '3': issue_ids.get('ISSUE3'),
        '4': issue_ids.get('ISSUE4'),
        '5': issue_ids.get('ISSUE5'),
        '6': issue_ids.get('ISSUE6'),
        '7': issue_ids.get('ISSUE7'),
    }
    status_to_id = {
        'Backlog': STATE_BACKLOG,
        'In Progress': STATE_IN_PROGRESS,
        'Done': STATE_DONE,
    }
    changes = []
    for phase, new_status in phase_statuses.items():
        old_status = old_statuses.get(phase, 'Backlog')
        if new_status != old_status:
            issue_id = phase_to_issue.get(phase)
            state_id = status_to_id.get(new_status)
            if issue_id and state_id:
                result = linear_query(
                    'mutation($id: String!, $stateId: String!) { issueUpdate(id: $id, input: {stateId: $stateId}) { issue { id state { name } } } }',
                    {'id': issue_id, 'stateId': state_id}
                )
                if result and 'data' in result:
                    changes.append(f'Phase {phase}: {old_status} → {new_status}')
    return changes

def count_done(tasks_done):
    return sum(1 for v in tasks_done.values() if v)

def main():
    state = load_state()
    now = time.time()
    snapshot = get_file_snapshot()
    tasks_done = check_tasks_done()
    phase_statuses = calc_phase_statuses(tasks_done)
    total_done = count_done(tasks_done)
    resume_point = find_resume_point(tasks_done)
    all_complete = resume_point is None

    # Initialize on first run
    if state['last_check'] is None:
        state['last_check'] = now
        state['file_snapshot'] = snapshot
        state['phase_statuses'] = phase_statuses
        save_state(state)
        print('INIT: First run, state saved. No action.', file=sys.stderr)
        return

    # Check for file changes
    files_changed = (snapshot != state['file_snapshot'])
    old_phases = state['phase_statuses']
    phase_changes = [f'Phase {p}: {old_phases.get(p, "Backlog")} → {phase_statuses[p]}'
                     for p in phase_statuses if phase_statuses[p] != old_phases.get(p, 'Backlog')]

    # Update state
    state['file_snapshot'] = snapshot
    state['phase_statuses'] = phase_statuses

    # --- DECISION TREE ---

    build_running = state.get('build_task_uuid') is not None
    stuck = build_running and not files_changed
    state['consecutive_stuck'] = state.get('consecutive_stuck', 0) + 1 if stuck else 0

    # Case 1: All tasks complete
    if all_complete:
        state['build_task_uuid'] = None
        state['consecutive_stuck'] = 0
        save_state(state)
        if phase_changes:
            issue_ids = load_linear_issue_ids()
            update_linear_issues(phase_statuses, old_phases, issue_ids)
        # Signal completion via exit code
        print(f'COMPLETE: All 65 tasks done. {total_done}/65', file=sys.stderr)
        sys.exit(42)  # Special exit code = all done
        return

    # Case 2: Build running and making progress — just update Linear if phases changed
    if build_running and files_changed:
        state['consecutive_stuck'] = 0
        save_state(state)
        if phase_changes:
            issue_ids = load_linear_issue_ids()
            linear_changes = update_linear_issues(phase_statuses, old_phases, issue_ids)
        print(f'PROGRESS: {total_done}/65 tasks done, resume={resume_point}, changes={phase_changes}', file=sys.stderr)
        state['last_check'] = now
        save_state(state)
        return

    # Case 3: Stuck detection — need 2 consecutive stuck checks (30 min) before acting
    if state['consecutive_stuck'] < 2:
        save_state(state)
        print(f'POTENTIALLY STUCK: {state["consecutive_stuck"]}/2 checks without changes. Waiting.', file=sys.stderr)
        state['last_check'] = now
        save_state(state)
        return

    # Case 4: CONFIRMED STUCK — kill and restart
    print(f'STUCK DETECTED: Build task {state["build_task_uuid"]} stuck for 30min with no file changes. Resuming from task {resume_point}.', file=sys.stderr)
    state['build_task_uuid'] = None
    state['consecutive_stuck'] = 0
    state['last_resume_task'] = resume_point

    # Update Linear
    issue_ids = load_linear_issue_ids()
    linear_changes = update_linear_issues(phase_statuses, old_phases, issue_ids)

    # Signal restart via exit code + stdout
    restart_info = {
        'action': 'restart',
        'resume_task': resume_point,
        'tasks_done': total_done,
        'linear_changes': linear_changes,
        'phase_statuses': phase_statuses,
    }
    print(json.dumps(restart_info))
    state['last_check'] = now
    save_state(state)
    sys.exit(10)  # Special exit code = need restart

if __name__ == '__main__':
    main()
