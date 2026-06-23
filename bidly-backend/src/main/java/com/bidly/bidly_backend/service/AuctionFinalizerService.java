package com.bidly.bidly_backend.service;

import com.bidly.bidly_backend.model.ItemCatalogo;
import com.bidly.bidly_backend.model.Subasta;
import com.bidly.bidly_backend.repository.ItemCatalogoRepository;
import com.bidly.bidly_backend.repository.SubastaRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class AuctionFinalizerService {

    @Autowired private ItemCatalogoRepository itemCatalogoRepository;
    @Autowired private SubastaRepository subastaRepository;
    @Autowired private SubastaEstadoService subastaEstadoService;
    @Autowired private SubastaService subastaService;
    @Autowired private ItemAdjudicacionService itemAdjudicacionService;

    @Scheduled(fixedDelay = 60000)
    public void finalizarItemsVencidos() {
        LocalDateTime ahora = LocalDateTime.now();
        List<Subasta> abiertas = subastaRepository.findByEstado("abierta");
        subastaEstadoService.aplicarOverrides(abiertas);

        Set<Long> subastasARevisar = new HashSet<>();

        for (Subasta subasta : abiertas) {
            if (!subastaService.inactividadVencida(subasta, ahora)) continue;

            List<ItemCatalogo> items = itemCatalogoRepository
                    .findByCatalogoSubastaIdentificador(subasta.getIdentificador());

            for (ItemCatalogo item : items) {
                if ("si".equals(item.getSubastado())) continue;

                ItemAdjudicacionService.Resultado resultado = itemAdjudicacionService
                        .finalizarItem(item.getIdentificador(), true);

                if (resultado == ItemAdjudicacionService.Resultado.ADJUDICADO
                        || resultado == ItemAdjudicacionService.Resultado.CERRADO_SIN_PUJAS) {
                    subastasARevisar.add(subasta.getIdentificador());
                }
            }
        }

        for (Long subastaId : subastasARevisar) {
            itemAdjudicacionService.cerrarSubastaSiCorresponde(subastaId);
        }

        cerrarSubastasCompletasAbiertas();
    }

    private void cerrarSubastasCompletasAbiertas() {
        for (Subasta subasta : subastaRepository.findByEstado("abierta")) {
            List<ItemCatalogo> items = itemCatalogoRepository
                    .findByCatalogoSubastaIdentificador(subasta.getIdentificador());
            if (items.isEmpty()) continue;
            boolean todos = items.stream().allMatch(i -> "si".equals(i.getSubastado()));
            if (todos) {
                subastaEstadoService.aplicarEstado(subasta.getIdentificador(), "cerrada");
            }
        }
    }
}
