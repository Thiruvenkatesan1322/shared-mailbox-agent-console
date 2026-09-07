from django.test import SimpleTestCase
from django.urls import reverse

from .workflow_data import WORKFLOWS


class DashboardTests(SimpleTestCase):
	def test_dashboard_renders_both_workflows(self):
		response = self.client.get(reverse('operations:dashboard'))

		self.assertEqual(response.status_code, 200)
		self.assertContains(response, 'Agent Operations Console')
		self.assertContains(response, 'Delegation Request')
		self.assertContains(response, 'Shared Mailbox Access Issue')
		self.assertContains(response, 'workflow-data')

	def test_workflows_include_control_points_and_closure(self):
		for workflow in WORKFLOWS.values():
			steps = workflow['steps']
			gates = [step['gate']['kind'] for step in steps if 'gate' in step]

			self.assertGreaterEqual(len(gates), 2)
			self.assertIn('confirmation', gates)
			self.assertTrue(steps[-1]['final'])
			self.assertEqual(steps[-1]['stage'], 'resolve')
