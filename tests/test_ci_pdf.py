import xmlrunner
import os
import sys
import unittest
import requests
import json
import random
from config import shared_dict, logger

class PdfTest(unittest.TestCase):
    def setUp(self):
        pass

    def tearDown(self):
        pass

    def test_procedure_pdf(self):
        url = '{0}/pdf/procedures/{1}/versions/{2}'.format(shared_dict['host'], 'europa-procedure-10001', '0')

        logger.debug('test_procedure_pdf url: %s', url)

        res = requests.get(url, headers=shared_dict['headers'])

        if res.status_code != 200:
            logger.debug('res.status_code: %s', res.status_code)
            logger.debug('res.text: %s', res.text)
            self.assertEqual(res.status_code, 200)
        logger.debug('res.headers: %s', res.headers)
        zname = "procedure.pdf"
        zfile = open(zname, 'wb')
        zfile.write(res.content)
        zfile.close()
        
    def test_execution_pdf(self):
        url = '{0}/pdf/executions/{1}'.format(shared_dict['host'], 'europa-ingenium-11118')

        logger.debug('test_execution_pdf url: %s', url)

        res = requests.get(url, headers=shared_dict['headers'])

        if res.status_code != 200:
            logger.debug('res.status_code: %s', res.status_code)
            logger.debug('res.text: %s', res.text)
            self.assertEqual(res.status_code, 200)
        logger.debug('res.headers: %s', res.headers)
        zname = "execution.pdf"
        zfile = open(zname, 'wb')
        zfile.write(res.content)
        zfile.close()        
        
        
            

if __name__ == '__main__':
    unittest.main(testRunner=xmlrunner.XMLTestRunner(output="./test-reports/"))
