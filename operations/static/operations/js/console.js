(() => {
    'use strict';

    const workflows = JSON.parse(document.getElementById('workflow-data').textContent);
    const elements = {
        runButton: document.getElementById('run-button'),
        resetButton: document.getElementById('reset-button'),
        runState: document.getElementById('run-state'),
        description: document.getElementById('workflow-description'),
        bannerNumber: document.getElementById('banner-number'),
        bannerTime: document.getElementById('banner-time'),
        stageMap: document.getElementById('stage-map'),
        flowProgress: document.getElementById('flow-progress'),
        executionList: document.getElementById('execution-list'),
        checkpoint: document.getElementById('checkpoint-value'),
        elapsed: document.getElementById('elapsed-value'),
        evidenceCount: document.getElementById('evidence-count'),
        gateDialog: document.getElementById('gate-dialog'),
        gateEyebrow: document.getElementById('gate-eyebrow'),
        gateTitle: document.getElementById('gate-title'),
        gateMessage: document.getElementById('gate-message'),
        gateRecipient: document.getElementById('gate-recipient'),
        gateChannel: document.getElementById('gate-channel'),
        gateCheckpoint: document.getElementById('gate-checkpoint'),
        gatePrimary: document.getElementById('gate-primary'),
        gateSecondary: document.getElementById('gate-secondary'),
        toast: document.getElementById('toast'),
    };

    let activeKey = 'delegation';
    let currentStepIndex = -1;
    let selectedStepIndex = -1;
    let running = false;
    let complete = false;
    let evidenceTotal = 0;
    let elapsedSeconds = 0;
    let stepTimer = null;
    let toastTimer = null;

    const workflow = () => workflows[activeKey];

    const refreshIcons = () => {
        if (window.lucide) {
            window.lucide.createIcons({ attrs: { 'stroke-width': 1.8 } });
        }
    };

    const setText = (id, value) => {
        document.getElementById(id).textContent = value;
    };

    const setRunState = (label, stateClass) => {
        elements.runState.className = `run-state ${stateClass}`;
        elements.runState.innerHTML = `<span></span> ${label}`;
    };

    const setRunButton = (mode) => {
        const config = {
            ready: ['play', 'Run simulation'],
            running: ['pause', 'Pause run'],
            paused: ['play', 'Resume run'],
            blocked: ['lock-keyhole', 'Awaiting decision'],
            complete: ['rotate-ccw', 'Replay simulation'],
            escalated: ['triangle-alert', 'Run stopped'],
        }[mode];
        elements.runButton.innerHTML = `<i data-lucide="${config[0]}" aria-hidden="true"></i><span>${config[1]}</span>`;
        elements.runButton.disabled = mode === 'blocked' || mode === 'escalated';
        refreshIcons();
    };

    const showToast = (message) => {
        window.clearTimeout(toastTimer);
        elements.toast.textContent = message;
        elements.toast.classList.add('is-visible');
        toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2500);
    };

    const renderStages = () => {
        elements.stageMap.innerHTML = workflow().stages.map((stage, index) => `
            <div class="stage-node" data-stage="${stage.id}">
                <span class="stage-marker">${String(index + 1).padStart(2, '0')}</span>
                <span>${stage.label}</span>
            </div>
        `).join('');
        updateStages();
    };

    const updateStages = () => {
        const stages = workflow().stages;
        const currentStage = currentStepIndex >= 0 ? workflow().steps[currentStepIndex].stage : null;
        const currentStageIndex = stages.findIndex((stage) => stage.id === currentStage);

        elements.stageMap.querySelectorAll('.stage-node').forEach((node, index) => {
            node.classList.toggle('is-complete', complete || (currentStageIndex >= 0 && index < currentStageIndex));
            node.classList.toggle('is-active', !complete && index === currentStageIndex);
            const marker = node.querySelector('.stage-marker');
            marker.textContent = complete || index < currentStageIndex ? '✓' : String(index + 1).padStart(2, '0');
        });
    };

    const updateTopology = (step) => {
        document.querySelectorAll('.topology-node').forEach((node) => node.classList.remove('is-active'));
        if (!step) return;

        const systems = [];
        const system = step.system.toLowerCase();
        const connector = step.connector.toLowerCase();
        if (system.includes('service')) systems.push('ServiceNow');
        if (system.includes('integration')) systems.push('Integration Layer');
        if (system.includes('agent') || system.includes('entra')) systems.push('Agent Runtime');
        if (system.includes('openai')) systems.push('Azure OpenAI');
        if (connector.includes('mcp') || connector.includes('powershell')) systems.push('MCP Gateway');
        if (system.includes('exchange') || system.includes('teams') || system.includes('outlook')) systems.push('Exchange Online');

        systems.forEach((name) => {
            const node = document.querySelector(`.topology-node[data-system="${name}"]`);
            if (node) node.classList.add('is-active');
        });
    };

    const updateContext = () => {
        const data = workflow();
        const incident = data.incident;
        const run = data.run;
        elements.description.textContent = data.description;
        elements.bannerNumber.textContent = incident.number;
        elements.bannerTime.textContent = incident.created;
        setText('incident-type', incident.type);
        setText('incident-number', incident.number);
        setText('ticket-state', incident.state);
        setText('ticket-summary', incident.summary);
        setText('mailbox-value', incident.mailbox);
        setText('requester-value', incident.requester);
        setText('owner-value', incident.owner);
        setText('permission-value', incident.permission);
        setText('assignment-value', incident.assignment_group);
        setText('sla-value', incident.target_sla);
        setText('run-id', run.id);
        setText('correlation-id', run.correlation_id);
        setText('policy-id', run.policy);
        setText('risk-value', run.risk);
        setText('priority-badge', incident.priority.split(' ')[0]);
    };

    const emptyExecutionMarkup = () => `
        <div class="empty-execution">
            <div>
                <span class="empty-visual"><i data-lucide="radar" aria-hidden="true"></i></span>
                <b>Workflow armed and waiting</b>
                <p>Run the simulation to follow the ServiceNow event through classification, guarded tool execution, verification, and closure.</p>
            </div>
        </div>
    `;

    const resetInspector = () => {
        setText('inspector-heading', 'No operation selected');
        setText('inspector-agent', 'Awaiting run');
        setText('inspector-duration', '--');
        setText('connector-label', '--');
        document.getElementById('command-output').textContent = 'Run the simulation to inspect each agent operation.';
        document.getElementById('request-output').textContent = '{}';
        document.getElementById('response-output').textContent = '{}';
        document.getElementById('evidence-list').innerHTML = '<li>No evidence captured yet.</li>';
        document.getElementById('policy-list').innerHTML = `
            <div><dt>Identity</dt><dd>--</dd></div>
            <div><dt>Authorization</dt><dd>--</dd></div>
            <div><dt>Data class</dt><dd>--</dd></div>
        `;
        setText('guardrail-text', 'Waiting for an operation');
    };

    const resetWorkflow = () => {
        window.clearTimeout(stepTimer);
        running = false;
        complete = false;
        currentStepIndex = -1;
        selectedStepIndex = -1;
        evidenceTotal = 0;
        elapsedSeconds = 0;
        updateContext();
        renderStages();
        updateTopology(null);
        elements.executionList.innerHTML = emptyExecutionMarkup();
        elements.flowProgress.textContent = `0 / ${workflow().steps.length} operations`;
        elements.checkpoint.textContent = 'Not started';
        elements.elapsed.textContent = '00:00';
        elements.evidenceCount.textContent = '0';
        setText('ticket-state', workflow().incident.state);
        setRunState('Ready', 'state-ready');
        setRunButton('ready');
        resetInspector();
        document.querySelectorAll('.scenario-button').forEach((button) => {
            button.disabled = false;
            button.classList.toggle('is-active', button.dataset.workflow === activeKey);
        });
        if (elements.gateDialog.open) elements.gateDialog.close();
        refreshIcons();
    };

    const statusIcon = (status) => ({
        running: 'loader-circle',
        complete: 'circle-check',
        failed: 'circle-x',
        waiting: 'clock-3',
    })[status];

    const statusLabel = (status) => ({
        running: 'Executing',
        complete: 'Verified',
        failed: 'Escalated',
        waiting: 'Awaiting human',
    })[status];

    const createEvent = (step, index) => {
        if (currentStepIndex === 0) elements.executionList.innerHTML = '';
        const event = document.createElement('button');
        event.type = 'button';
        event.className = 'execution-event is-running is-selected';
        event.dataset.stepIndex = index;
        event.innerHTML = `
            <span class="event-index">${String(index + 1).padStart(2, '0')}</span>
            <span class="event-main">
                <span class="event-title-row">
                    <strong>${step.title}</strong>
                    <span class="event-status"><i data-lucide="${statusIcon('running')}" aria-hidden="true"></i>${statusLabel('running')}</span>
                </span>
                <span class="event-agent">${step.agent}</span>
                <span class="event-summary">${step.summary}</span>
                <span class="event-technical">
                    <span><i data-lucide="wrench" aria-hidden="true"></i>${step.skill}</span>
                    <span><i data-lucide="plug-zap" aria-hidden="true"></i>${step.connector}</span>
                    <span><i data-lucide="timer" aria-hidden="true"></i>${step.duration}</span>
                    ${step.gate ? '<span class="event-gate-chip"><i data-lucide="user-round-check" aria-hidden="true"></i>human gate</span>' : ''}
                </span>
                ${step.delay ? '<span class="wait-probes"><span class="probe"></span><span class="probe"></span><span class="probe"></span><span class="probe"></span></span>' : ''}
            </span>
        `;
        event.addEventListener('click', () => selectStep(index));
        elements.executionList.querySelectorAll('.execution-event').forEach((item) => item.classList.remove('is-selected'));
        elements.executionList.appendChild(event);
        elements.executionList.scrollTo({ top: elements.executionList.scrollHeight, behavior: 'smooth' });
        refreshIcons();
        return event;
    };

    const setEventStatus = (event, status) => {
        event.classList.remove('is-running', 'is-complete', 'is-failed');
        event.classList.add(`is-${status}`);
        const statusElement = event.querySelector('.event-status');
        statusElement.innerHTML = `<i data-lucide="${statusIcon(status)}" aria-hidden="true"></i>${statusLabel(status)}`;
        refreshIcons();
    };

    const selectStep = (index) => {
        selectedStepIndex = index;
        document.querySelectorAll('.execution-event').forEach((event) => {
            event.classList.toggle('is-selected', Number(event.dataset.stepIndex) === index);
        });
        renderInspector(workflow().steps[index]);
    };

    const renderInspector = (step) => {
        setText('inspector-heading', step.title);
        setText('inspector-agent', `${step.agent} / ${step.system}`);
        setText('inspector-duration', step.duration);
        setText('connector-label', step.connector);
        document.getElementById('command-output').textContent = step.command;
        document.getElementById('request-output').textContent = JSON.stringify(step.request, null, 2);
        document.getElementById('response-output').textContent = JSON.stringify(step.response, null, 2);
        document.getElementById('evidence-list').innerHTML = step.evidence.map((item) => `<li>${item}</li>`).join('');
        document.getElementById('policy-list').innerHTML = `
            <div><dt>Identity</dt><dd>${step.policy.identity}</dd></div>
            <div><dt>Authorization</dt><dd>${step.policy.authorization}</dd></div>
            <div><dt>Data class</dt><dd>${step.policy.data_class}</dd></div>
        `;
        setText('guardrail-text', `Passed for ${step.skill}`);
    };

    const checkpointFor = (step) => {
        const responseCheckpoint = step.response.checkpoint;
        if (responseCheckpoint) return responseCheckpoint;
        const match = step.evidence.find((item) => item.toLowerCase().includes('checkpoint'));
        return match ? match.match(/cp-\d+/i)?.[0] || 'Committed' : elements.checkpoint.textContent;
    };

    const completeStep = (step, event) => {
        setEventStatus(event, step.gate ? 'waiting' : 'complete');
        evidenceTotal += step.evidence.length;
        elements.evidenceCount.textContent = String(evidenceTotal);
        elements.flowProgress.textContent = `${currentStepIndex + 1} / ${workflow().steps.length} operations`;
        elements.checkpoint.textContent = checkpointFor(step);

        if (step.stage === 'intake') setText('ticket-state', 'In Progress');

        if (step.gate) {
            running = false;
            setRunState('Blocked by gate', 'state-blocked');
            setRunButton('blocked');
            openGate(step, event);
            return;
        }

        if (step.final) {
            finishRun();
            return;
        }

        stepTimer = window.setTimeout(processNextStep, 360);
    };

    const processNextStep = () => {
        if (!running) return;
        const nextIndex = currentStepIndex + 1;
        if (nextIndex >= workflow().steps.length) {
            finishRun();
            return;
        }

        currentStepIndex = nextIndex;
        const step = workflow().steps[currentStepIndex];
        updateStages();
        updateTopology(step);
        const event = createEvent(step, currentStepIndex);
        selectStep(currentStepIndex);
        const delay = step.delay || (step.gate ? 850 : 680);
        stepTimer = window.setTimeout(() => completeStep(step, event), delay);
    };

    const startOrResumeRun = () => {
        if (complete) {
            resetWorkflow();
        }

        running = true;
        document.querySelectorAll('.scenario-button').forEach((button) => { button.disabled = true; });
        setRunState('Executing', 'state-running');
        setRunButton('running');
        if (currentStepIndex < 0) {
            showToast(`${workflow().incident.number} accepted by the integration layer`);
        }
        processNextStep();
    };

    const pauseRun = () => {
        window.clearTimeout(stepTimer);
        running = false;
        setRunState('Paused', 'state-paused');
        setRunButton('paused');
        showToast('Workflow paused at the current checkpoint');
    };

    const openGate = (step, event) => {
        const gate = step.gate;
        elements.gateEyebrow.textContent = gate.eyebrow;
        elements.gateTitle.textContent = gate.title;
        elements.gateMessage.textContent = gate.message;
        elements.gateRecipient.textContent = gate.recipient;
        elements.gateChannel.textContent = gate.channel;
        elements.gateCheckpoint.textContent = step.response.checkpoint;
        elements.gatePrimary.querySelector('span').textContent = gate.primary;
        elements.gateSecondary.textContent = gate.secondary;
        elements.gatePrimary.dataset.stepIndex = String(currentStepIndex);
        elements.gateSecondary.dataset.stepIndex = String(currentStepIndex);
        event.dataset.gateState = 'waiting';
        elements.gateDialog.showModal();
    };

    const approveGate = () => {
        const index = Number(elements.gatePrimary.dataset.stepIndex);
        const step = workflow().steps[index];
        const event = elements.executionList.querySelector(`[data-step-index="${index}"]`);
        step.response.state = step.gate.kind === 'diagnostic' ? 'OWA access confirmed' : 'Approved / confirmed';
        event.dataset.gateState = 'approved';
        setEventStatus(event, 'complete');
        renderInspector(step);
        elements.gateDialog.close();
        running = true;
        setRunState('Executing', 'state-running');
        setRunButton('running');
        showToast(`${step.gate.title}: response captured`);
        stepTimer = window.setTimeout(processNextStep, 420);
    };

    const rejectGate = () => {
        const index = Number(elements.gateSecondary.dataset.stepIndex);
        const step = workflow().steps[index];
        const event = elements.executionList.querySelector(`[data-step-index="${index}"]`);
        step.response.state = 'Rejected or unresolved';
        setEventStatus(event, 'failed');
        elements.gateDialog.close();
        running = false;
        setRunState('Escalated', 'state-escalated');
        setRunButton('escalated');
        setText('ticket-state', 'Escalated');
        renderInspector(step);
        appendEscalation(step);
        showToast('Automation stopped and routed to Messaging Operations');
    };

    const appendEscalation = (sourceStep) => {
        const event = document.createElement('div');
        event.className = 'execution-event is-failed';
        event.innerHTML = `
            <span class="event-index">!</span>
            <span class="event-main">
                <span class="event-title-row"><strong>Manual support handoff created</strong><span class="event-status"><i data-lucide="triangle-alert" aria-hidden="true"></i>Escalated</span></span>
                <span class="event-agent">Root Agent / Exception Handler</span>
                <span class="event-summary">The workflow preserved its checkpoint and attached all evidence from ${sourceStep.title} to the ServiceNow escalation.</span>
                <span class="event-technical"><span><i data-lucide="route" aria-hidden="true"></i>Messaging Operations L2</span><span><i data-lucide="paperclip" aria-hidden="true"></i>${evidenceTotal} evidence records</span></span>
            </span>
        `;
        elements.executionList.appendChild(event);
        elements.executionList.scrollTo({ top: elements.executionList.scrollHeight, behavior: 'smooth' });
        refreshIcons();
    };

    const finishRun = () => {
        running = false;
        complete = true;
        updateStages();
        updateTopology(workflow().steps.at(-1));
        setRunState('Resolved', 'state-complete');
        setRunButton('complete');
        setText('ticket-state', workflow().incident.type === 'Incident' ? 'Resolved' : 'Closed Complete');
        document.querySelectorAll('.scenario-button').forEach((button) => { button.disabled = false; });
        showToast(`${workflow().incident.number} resolved and evidence synchronized to ServiceNow`);
    };

    const switchWorkflow = (key) => {
        if (running || elements.gateDialog.open) {
            showToast('Pause or complete the active run before switching scenarios');
            return;
        }
        activeKey = key;
        resetWorkflow();
    };

    document.querySelectorAll('.scenario-button').forEach((button) => {
        button.addEventListener('click', () => switchWorkflow(button.dataset.workflow));
    });

    elements.runButton.addEventListener('click', () => {
        if (running) pauseRun();
        else startOrResumeRun();
    });
    elements.resetButton.addEventListener('click', resetWorkflow);
    elements.gatePrimary.addEventListener('click', approveGate);
    elements.gateSecondary.addEventListener('click', rejectGate);
    elements.gateDialog.addEventListener('cancel', (event) => event.preventDefault());

    document.querySelectorAll('.tab-button').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach((tab) => {
                const active = tab === button;
                tab.classList.toggle('is-active', active);
                tab.setAttribute('aria-selected', String(active));
            });
            document.querySelectorAll('.tab-panel').forEach((panel) => {
                panel.classList.toggle('is-active', panel.dataset.panel === button.dataset.tab);
            });
        });
    });

    document.getElementById('copy-button').addEventListener('click', async () => {
        if (selectedStepIndex < 0) {
            showToast('Select an operation before copying');
            return;
        }
        const step = workflow().steps[selectedStepIndex];
        const payload = `${step.command}\n\nREQUEST\n${JSON.stringify(step.request, null, 2)}\n\nRESPONSE\n${JSON.stringify(step.response, null, 2)}`;
        try {
            await navigator.clipboard.writeText(payload);
            showToast('Tool call copied to clipboard');
        } catch {
            showToast('Clipboard access is unavailable in this browser');
        }
    });

    window.setInterval(() => {
        if (!running) return;
        elapsedSeconds += 1;
        const minutes = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
        const seconds = (elapsedSeconds % 60).toString().padStart(2, '0');
        elements.elapsed.textContent = `${minutes}:${seconds}`;
    }, 1000);

    resetWorkflow();
})();