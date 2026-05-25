
from unidecode import unidecode
import re
from faker import Faker
import pandas as pd
import random
from dep_mun_dian import mun_dep
from paises import Paises
from digitoDIAN import calcular_dv_dian

fake = Faker('ES_CO')
exp_reg_placa = r'^[a-zA-Z]{3}\d{3}|[a-zA-Z]{1}\d{4}|[a-zA-Z]{2}\d{4}|[a-zA-Z]{1}\d{5}|[a-zA-Z]{2}\d{5}|[a-zA-Z0-9]{7}$'


class Persona:
    def __init__(self, tipo, min_veh, max_veh):
        self.tipo = tipo
        if self.tipo == "Natural":
            self.razon_social = (unidecode(fake.first_name()))
            self.nombre = ''
            self.apellido = unidecode(fake.last_name())
            self.documento = fake.random_number(digits=fake.random_int(min=10, max=10))
            self.cod_ver = ''
            self.nit = fake.random_int(min=1, max=2)
        elif self.tipo == "Juridico":
            self.razon_social = unidecode(fake.company()).replace(',', ' ')
            self.nombre= unidecode(fake.name())
            self.apellido = ''
            self.documento = fake.random_number(digits=fake.random_int(min=9, max=9))
            self.cod_ver = calcular_dv_dian(self.documento)
            self.nit = '3'
        self.res_fiscal = fake.random_element(elements=("Declarante", "No Declarante", ""))
        self.dir = fake.address().split('\n')[0] + ' ' + fake.address().split('\n')[1]
        self.pais = random.choice(list(Paises.keys()))
        self.dep = random.choice(list(mun_dep.keys()))
        self.mun = random.choice(mun_dep[self.dep])
        self.email = fake.email(domain='yopmail.com')
        self.cel = "3" + fake.numerify(text="#########")
        self.tel_eme = ''
        self.vehiculos = [Vehiculo() for _ in range(random.randint(min_veh, max_veh))]  # Crea entre 1 y 3 vehículos para cada persona

class Vehiculo:
    def __init__(self):
        
        while True:
            placa_temp = fake.license_plate()
            self.categoria = fake.random_int(min=1, max=7)
            if re.match(exp_reg_placa, placa_temp):
                self.placa = placa_temp
                break
