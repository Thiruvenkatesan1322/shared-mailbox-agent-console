from django.shortcuts import render

from .workflow_data import WORKFLOWS


def dashboard(request):
	return render(
		request,
		'operations/dashboard.html',
		{
			'workflows': WORKFLOWS,
			'default_workflow': WORKFLOWS['delegation'],
		},
	)
