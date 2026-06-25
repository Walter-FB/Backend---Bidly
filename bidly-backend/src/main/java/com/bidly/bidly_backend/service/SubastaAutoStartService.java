package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.repository.SubastaRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SubastaAutoStartService {

    private static final Logger log = LoggerFactory.getLogger(SubastaAutoStartService.class);

    @Autowired
    private SubastaRepository subastaRepository;

    @Autowired
    private SubastaEstadoService subastaEstadoService;

    @Scheduled(fixedDelay = 30000)
    public void iniciarSubastasProgramadas() {
        List<Long> ids = subastaRepository.findIdsListasParaIniciar();
        for (Long id : ids) {
            try {
                subastaEstadoService.iniciarSubasta(id);
            } catch (Exception e) {
                log.warn("No se pudo iniciar subasta {}: {}", id, e.getMessage());
            }
        }
    }
}
