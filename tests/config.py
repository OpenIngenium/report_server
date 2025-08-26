import json
import os
from ingenium_client import shared_dict, logger

server = os.environ.get('REPORT_SERVICE_URL', 'http://localhost:3003')

api_path = '{0}/api/v1'.format(server)     

logger.debug('api_path: %s', api_path)    
shared_dict['host'] = api_path
