import xmlrunner
import os
import sys
import unittest
import requests
import json
import random
from config import shared_dict, logger

class DiffTest(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_difference_report(self):
        url = '{0}/difference_report'.format(shared_dict['host'])

        payload = {'base_type': 'PROCEDURE', 'base_id': 'europa-procedure-10171', 'base_version': 1, 'target_type': 'PROCEDURE', 'target_id': 'europa-procedure-10171', 'target_version': 2}
                      
        result = requests.get(url, params=payload, headers=shared_dict['headers'])
        logger.debug('test_diff_report url: %s', result.url)    

        if result.status_code != 202:
           logger.debug('result.status_code: %s', result.status_code)
           logger.debug('result.text: %s', result.text)
        self.assertEqual(result.status_code, 202)
        logger.debug('res.headers: %s', result.headers)
                    

if __name__ == '__main__':
    unittest.main(testRunner=xmlrunner.XMLTestRunner(output="./test-reports/"))
