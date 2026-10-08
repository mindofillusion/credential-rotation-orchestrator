import json
import pathlib
import unittest
from build import normalize, select

ROOT=pathlib.Path(__file__).resolve().parent

class CatalogueTests(unittest.TestCase):
    def test_reject_previews_and_floating_tags(self):
        for tag in ['v8.0rc2','release-4.0.0-a2','v4.0.0-canary.38','v2026.10.0-latest','6.0.0-b5','v0.64.x','v1.0.0-test.1','superset-helm-chart-0.22.8']:
            self.assertIsNone(normalize(tag,'generic'),tag)
    def test_valid_vendor_version_formats(self):
        for tag,expected in [('version/2026.8.3','2026.8.3'),('2.4.8-p5','2.4.8-p5'),('release-3.3.19','3.3.19'),('n8n@2.43.2','2.43.2')]:
            self.assertEqual(normalize(tag,'generic'),expected)
        self.assertEqual(normalize('release-2026-07-14c','dokuwiki'),'2026-07-14c')
    def test_branch_selection_not_feed_update_order(self):
        r=select([{'version':v} for v in ['10.6.18','11.3.18','11.4.7','11.4.8']])
        self.assertEqual([x['version'] for x in r],['11.4.8','11.3.18','10.6.18'])
    def test_no_false_installation_claim(self):
        c=json.loads((ROOT/'catalogue.json').read_text())
        self.assertEqual(c['summary']['historically_qualified_versions'],6)
        self.assertEqual(c['summary']['new_installations_this_inventory'],0)
        for a in c['applications']:
            for v in a['versions']:
                self.assertFalse(v['installation_ready'])
                self.assertIsNone(v['image_digest'])
                self.assertIsNone(v['artifact_sha256'])
                if v['state']=='historically-qualified': self.assertEqual(v['version'],a['qualification']['version'])
    def test_campaign_has_unique_ids_and_cannot_execute(self):
        c=json.loads((ROOT/'campaign.json').read_text())['instances']
        self.assertEqual(len({x['id'] for x in c}),len(c))
        for x in c:
            self.assertFalse(x['execution_enabled'])
            self.assertIn('publisher-artifact-and-runtime-lock',x['gates'])
            self.assertIn('T02',x['scenarios'])
    def test_component_versions_not_mislabeled(self):
        c=json.loads((ROOT/'catalogue.json').read_text())
        for a in c['applications']:
            if a['id'] in ['seafile','superset','odoo','canvas']:
                self.assertEqual(a['versions'],[])

if __name__=='__main__': unittest.main()
